import type { CallToolResult, ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { TraceEvent } from "@ari/core";
import { createHttpRecorder } from "@ari/ai-sdk";
import {
  createMcpSdkTransport,
  createMergeAgentHandlerClient,
  type MergeAgentHandlerConfig,
  type ToolCallProvenance
} from "@ari/merge";
import { z } from "zod";

type ProxyServerOptions = {
  collectorUrl: string;
  merge: MergeAgentHandlerConfig;
};

type ActiveRun = {
  runId: string;
  listedTools: boolean;
  idleTimer: NodeJS.Timeout | undefined;
  contextScope: ContextScope | undefined;
};

type ContextScope = {
  title: string | undefined;
  selectedCount: number;
  excludedCount: number;
  provenance: ToolCallProvenance;
};

const ARI_CONTEXT_SCOPE_TOOL_NAME = "ari_record_context_scope";

const contextItemSchema = z.object({
  sourceId: z.string().min(1),
  sourceType: z.string().min(1),
  title: z.string().min(1),
  reason: z.string().min(1),
  permissionRule: z.string().min(1)
});

const contextScopeInputSchema = z.object({
  title: z.string().min(1).optional(),
  permissionSnapshotId: z.string().min(1).optional(),
  contextDecisionId: z.string().min(1).optional(),
  authorizationDecisionId: z.string().min(1).optional(),
  authorizationRule: z.string().min(1),
  selected: z.array(contextItemSchema).min(1),
  excluded: z.array(contextItemSchema).default([])
});

export async function createAriMcpProxyServer(options: ProxyServerOptions): Promise<Server> {
  const transport = await createMcpSdkTransport(options.merge);
  const merge = createMergeAgentHandlerClient(options.merge, transport);
  const recorder = createHttpRecorder({ collectorUrl: options.collectorUrl });
  let activeRun: ActiveRun | undefined;

  const server = new Server(
    {
      name: "agent-runtime-inspector-proxy",
      version: "0.0.0"
    },
    {
      capabilities: {
        tools: {}
      },
      instructions:
        "Proxy Merge Agent Handler tools through Agent Runtime Inspector so tool lists and tool calls are recorded locally."
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async (): Promise<ListToolsResult> => {
    const result = await merge.listTools("tool_discovery");

    if (!result.ok) {
      return {
        tools: [ariContextScopeTool()],
        _meta: {
          ariError: result.error.message
        }
      };
    }

    return {
      tools: [
        ariContextScopeTool(),
        ...result.data.tools.map((tool) => ({
          name: tool.name,
          ...(tool.description ? { description: tool.description } : {}),
          inputSchema: normalizeInputSchema(tool.inputSchema)
        }))
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    if (request.params.name === ARI_CONTEXT_SCOPE_TOOL_NAME) {
      return await recordContextScope(toRecord(request.params.arguments ?? {}));
    }

    const run = await ensureRun();
    clearIdleCompletion(run);

    if (!run.contextScope) {
      await safeRecord({
        id: crypto.randomUUID(),
        runId: run.runId,
        type: "tool.blocked",
        path: "action",
        source: "collector",
        timestamp: new Date().toISOString(),
        payload: {
          toolName: request.params.name,
          reason: "No context scope was recorded for this MCP run.",
          policy: "context_scope_required"
        }
      });
      await recordRunCompleted(
        run.runId,
        "error",
        "ARI blocked the tool call because no context scope was recorded for this MCP run."
      );
      activeRun = undefined;
      return textToolResult(
        `Call ${ARI_CONTEXT_SCOPE_TOOL_NAME} before calling forwarded Merge tools so ARI can bind the action to selected context, excluded context, and an authorization rule.`,
        true
      );
    }

    if (!run.listedTools) {
      const listed = await merge.listTools(run.runId, run.contextScope.provenance);

      if (!listed.ok) {
        await recordRunCompleted(run.runId, "error", listed.error.message);
        activeRun = undefined;
        return textToolResult(listed.error.message, true);
      }

      await safeRecord(listed.data.event);
      run.listedTools = true;
    }

    const toolName = request.params.name;
    const toolArguments = request.params.arguments ?? {};
    const result = await merge.callTool({
      runId: run.runId,
      toolName,
      arguments: toolArguments,
      provenance: run.contextScope.provenance
    });

    if (!result.ok) {
      await recordRunCompleted(run.runId, "error", result.error.message);
      activeRun = undefined;
      return textToolResult(result.error.message, true);
    }

    await safeRecord(result.data.started);
    await safeRecord(result.data.completed);
    await recordRunCompleted(
      run.runId,
      result.data.status,
      result.data.status === "success"
        ? `Merge Agent Handler called ${toolName} after ${run.contextScope.selectedCount} selected context item(s) and ${run.contextScope.excludedCount} excluded context item(s) were recorded.`
        : `Merge Agent Handler called ${toolName} after context scope recording, and the tool returned an error.`
    );
    activeRun = undefined;

    if (result.data.result !== undefined) {
      return normalizeToolResult(result.data.result, result.data.status === "error");
    }

    return textToolResult(result.data.errorMessage ?? `Merge Agent Handler could not call ${toolName}.`, true);
  });

  async function recordContextScope(input: Record<string, unknown>): Promise<CallToolResult> {
    const parsed = contextScopeInputSchema.safeParse(input);

    if (!parsed.success) {
      return textToolResult(parsed.error.message, true);
    }

    const run = await ensureRun(parsed.data.title);
    clearIdleCompletion(run);
    const provenance: ToolCallProvenance = {
      permissionSnapshotId: parsed.data.permissionSnapshotId ?? `perm_${crypto.randomUUID()}`,
      contextDecisionId: parsed.data.contextDecisionId ?? `ctx_${crypto.randomUUID()}`,
      authorizationDecisionId: parsed.data.authorizationDecisionId ?? `auth_${crypto.randomUUID()}`,
      authorizationRule: parsed.data.authorizationRule
    };

    run.contextScope = {
      title: parsed.data.title,
      selectedCount: parsed.data.selected.length,
      excludedCount: parsed.data.excluded.length,
      provenance
    };

    for (const item of parsed.data.selected) {
      await safeRecord(contextEvent(run.runId, "context.selected", provenance, item));
    }

    for (const item of parsed.data.excluded) {
      await safeRecord(contextEvent(run.runId, "context.excluded", provenance, item));
    }

    return textToolResult(
      `ARI recorded ${String(parsed.data.selected.length)} selected context item(s) and ${String(parsed.data.excluded.length)} excluded context item(s). Future Merge tool calls in this run will use context decision ${provenance.contextDecisionId}.`,
      false
    );
  }

  async function ensureRun(title?: string): Promise<ActiveRun> {
    if (activeRun) {
      return activeRun;
    }

    const run: ActiveRun = {
      runId: `run_${crypto.randomUUID()}`,
      listedTools: false,
      idleTimer: undefined,
      contextScope: undefined
    };

    activeRun = run;
    await safeRecord({
      id: crypto.randomUUID(),
      runId: run.runId,
      type: "run.started",
      path: "system",
      source: "collector",
      timestamp: new Date().toISOString(),
      payload: {
        title: title ?? "ARI MCP proxy run",
        scenario: "Record context scope, then forward one MCP tool call through Merge Agent Handler."
      }
    });

    return run;
  }

  function clearIdleCompletion(run: ActiveRun): void {
    if (!run.idleTimer) {
      return;
    }

    clearTimeout(run.idleTimer);
    run.idleTimer = undefined;
  }

  async function recordRunCompleted(
    runId: string,
    status: "success" | "error",
    summary: string
  ): Promise<void> {
    await safeRecord({
      id: crypto.randomUUID(),
      runId,
      type: "run.completed",
      path: "system",
      source: "collector",
      timestamp: new Date().toISOString(),
      payload: {
        status,
        summary
      }
    });
  }

  async function safeRecord(event: TraceEvent): Promise<void> {
    try {
      await recorder.record(event);
    } catch (error) {
      console.error(`ARI collector did not record ${event.type}: ${errorMessage(error)}`);
    }
  }

  return server;
}

function ariContextScopeTool(): ListToolsResult["tools"][number] {
  return {
    name: ARI_CONTEXT_SCOPE_TOOL_NAME,
    description:
      "Record the selected context, excluded context, and authorization rule that should justify subsequent proxied tool calls in this ARI run.",
    inputSchema: {
      type: "object",
      required: ["authorizationRule", "selected"],
      properties: {
        title: {
          type: "string",
          description: "Human-readable title for this agent run."
        },
        permissionSnapshotId: {
          type: "string",
          description: "Optional existing permission snapshot id. ARI generates one if omitted."
        },
        contextDecisionId: {
          type: "string",
          description: "Optional existing context decision id. ARI generates one if omitted."
        },
        authorizationDecisionId: {
          type: "string",
          description: "Optional existing authorization decision id. ARI generates one if omitted."
        },
        authorizationRule: {
          type: "string",
          description: "Rule or policy that permits later tool calls after context selection."
        },
        selected: {
          type: "array",
          minItems: 1,
          items: contextItemJsonSchema(),
          description: "Context the agent is allowed to use for this run."
        },
        excluded: {
          type: "array",
          items: contextItemJsonSchema(),
          description: "Context that was known but withheld from this run."
        }
      }
    }
  };
}

function contextItemJsonSchema(): Record<string, unknown> {
  return {
    type: "object",
    required: ["sourceId", "sourceType", "title", "reason", "permissionRule"],
    properties: {
      sourceId: {
        type: "string"
      },
      sourceType: {
        type: "string"
      },
      title: {
        type: "string"
      },
      reason: {
        type: "string"
      },
      permissionRule: {
        type: "string"
      }
    }
  };
}

function contextEvent(
  runId: string,
  type: "context.selected" | "context.excluded",
  provenance: ToolCallProvenance,
  item: z.infer<typeof contextItemSchema>
): TraceEvent {
  return {
    id: crypto.randomUUID(),
    runId,
    type,
    path: "context",
    source: "collector",
    timestamp: new Date().toISOString(),
    payload: {
      permissionSnapshotId: provenance.permissionSnapshotId,
      contextDecisionId: provenance.contextDecisionId,
      authorizationDecisionId: provenance.authorizationDecisionId,
      ...(provenance.authorizationRule ? { authorizationRule: provenance.authorizationRule } : {}),
      sourceId: item.sourceId,
      sourceType: item.sourceType,
      title: item.title,
      reason: item.reason,
      permissionRule: item.permissionRule
    }
  };
}

function normalizeInputSchema(inputSchema: unknown): ListToolsResult["tools"][number]["inputSchema"] {
  if (isObjectInputSchema(inputSchema)) {
    return inputSchema;
  }

  return {
    type: "object",
    properties: {}
  };
}

function normalizeToolResult(result: unknown, isError: boolean): CallToolResult {
  if (isCallToolResult(result)) {
    return {
      ...result,
      isError: result.isError === true || isError
    };
  }

  return textToolResult(JSON.stringify(result, null, 2), isError);
}

function textToolResult(text: string, isError: boolean): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text
      }
    ],
    isError
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function isCallToolResult(result: unknown): result is CallToolResult {
  if (!result || typeof result !== "object") {
    return false;
  }

  const candidate = result as {
    content?: unknown;
  };

  return Array.isArray(candidate.content);
}

function isObjectInputSchema(schema: unknown): schema is ListToolsResult["tools"][number]["inputSchema"] {
  if (!schema || typeof schema !== "object") {
    return false;
  }

  const candidate = schema as {
    type?: unknown;
  };

  return candidate.type === "object";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
