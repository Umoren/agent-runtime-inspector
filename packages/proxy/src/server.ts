import type { CallToolResult, ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { ToolCallProvenance, TraceEvent } from "@ari/core";
import { createHttpRecorder } from "@ari/ai-sdk";
import type { ActionProvider } from "./action-provider.js";
import {
  createScopePermissionEvaluator,
  type ContextProvider,
  type ContextRequest,
  type EvaluatedContext,
  type ExcludedContext,
  type PermissionEvaluator,
  type SelectedContext
} from "./context-provider.js";
import { createDenyAllPolicyEngine, type PolicyEngine } from "./policy.js";
import { z } from "zod";

export type ProxyServerOptions = {
  collectorUrl: string;
  actionProvider: ActionProvider;
  identity: {
    principalId: string;
    purpose: string;
  };
  contextProvider?: ContextProvider;
  permissionEvaluator?: PermissionEvaluator;
  policyEngine?: PolicyEngine;
  allowAgentDeclaredContext?: boolean;
};

type ActiveRun = {
  runId: string;
  listedTools: boolean;
  idleTimer: NodeJS.Timeout | undefined;
  contextScope: ContextScope | undefined;
};

type ContextScope = {
  title: string | undefined;
  principalId: string;
  principalScopes: readonly string[];
  purpose: string;
  selectedCount: number;
  excludedCount: number;
  selected: readonly {
    sourceId: string;
    sourceType: string;
  }[];
  provenance: ToolCallProvenance;
};

const ARI_CONTEXT_SCOPE_TOOL_NAME = "ari_record_context_scope";
const ARI_GET_CONTEXT_TOOL_NAME = "ari_get_context";

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
  selected: z.array(contextItemSchema).min(1),
  excluded: z.array(contextItemSchema).default([])
});

const contextRequestInputSchema = z.object({
  title: z.string().min(1).optional(),
  task: z.string().min(1),
  requesterId: z.string().min(1).optional(),
  purpose: z.string().min(1).optional()
});

// eslint-disable-next-line @typescript-eslint/no-deprecated
export function createAriMcpProxyServer(options: ProxyServerOptions): Server {
  const actionProvider = options.actionProvider;
  const recorder = createHttpRecorder({ collectorUrl: options.collectorUrl });
  const permissionEvaluator = options.permissionEvaluator ?? createScopePermissionEvaluator();
  const policyEngine = options.policyEngine ?? createDenyAllPolicyEngine();
  let activeRun: ActiveRun | undefined;

  // eslint-disable-next-line @typescript-eslint/no-deprecated
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
        "Route upstream MCP tools through Agent Runtime Inspector so context, authorization decisions, and tool execution are enforced and recorded locally."
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async (): Promise<ListToolsResult> => {
    const result = await actionProvider.listTools("tool_discovery");

    if (!result.ok) {
      return {
        tools: ariTools(options.allowAgentDeclaredContext === true),
        _meta: {
          ariError: result.error.message
        }
      };
    }

    return {
      tools: [
        ...ariTools(options.allowAgentDeclaredContext === true),
        ...result.data.tools.map((tool) => ({
          name: tool.name,
          ...(tool.description ? { description: tool.description } : {}),
          inputSchema: normalizeInputSchema(tool.inputSchema)
        }))
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    if (request.params.name === ARI_GET_CONTEXT_TOOL_NAME) {
      return await getContext(toRecord(request.params.arguments ?? {}));
    }

    if (request.params.name === ARI_CONTEXT_SCOPE_TOOL_NAME) {
      if (options.allowAgentDeclaredContext !== true) {
        return textToolResult("Agent-declared context is disabled for this ARI gateway.", true);
      }
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
          upstreamId: actionProvider.metadata.upstreamId,
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
        `Call ${ARI_GET_CONTEXT_TOOL_NAME} before calling an upstream tool so ARI can retrieve permitted context and authorize the action.`,
        true
      );
    }

    const toolName = request.params.name;
    const toolArguments = request.params.arguments ?? {};
    const authorizationDecisionId = `auth_${crypto.randomUUID()}`;
    const authorization = await policyEngine.evaluate({
      principal: {
        id: run.contextScope.principalId,
        scopes: run.contextScope.principalScopes
      },
      purpose: run.contextScope.purpose,
      upstream: {
        id: actionProvider.metadata.upstreamId,
        type: actionProvider.metadata.upstreamType
      },
      action: {
        name: toolName,
        arguments: toolArguments
      },
      context: {
        permissionSnapshotId: run.contextScope.provenance.permissionSnapshotId,
        contextDecisionId: run.contextScope.provenance.contextDecisionId,
        selected: run.contextScope.selected
      }
    });
    const actionProvenance: ToolCallProvenance = {
      ...run.contextScope.provenance,
      authorizationDecisionId,
      authorizationRule: authorization.policyId
    };

    await safeRecord({
      id: crypto.randomUUID(),
      runId: run.runId,
      type: "authorization.decided",
      path: "action",
      source: "policy",
      timestamp: new Date().toISOString(),
      payload: {
        permissionSnapshotId: actionProvenance.permissionSnapshotId,
        contextDecisionId: actionProvenance.contextDecisionId,
        authorizationDecisionId,
        authorizationRule: authorization.policyId,
        principalId: run.contextScope.principalId,
        purpose: run.contextScope.purpose,
        upstreamId: actionProvider.metadata.upstreamId,
        toolName,
        decision: authorization.decision,
        reason: authorization.reason,
        policyId: authorization.policyId,
        ...(authorization.policyVersion ? { policyVersion: authorization.policyVersion } : {})
      }
    });

    if (authorization.decision === "deny") {
      await safeRecord({
        id: crypto.randomUUID(),
        runId: run.runId,
        type: "tool.blocked",
        path: "action",
        source: "policy",
        timestamp: new Date().toISOString(),
        payload: {
          ...actionProvenance,
          toolName,
          upstreamId: actionProvider.metadata.upstreamId,
          reason: authorization.reason,
          policy: authorization.policyId
        }
      });
      await recordRunCompleted(run.runId, "error", `ARI blocked ${toolName}: ${authorization.reason}`);
      activeRun = undefined;
      return textToolResult(`ARI blocked ${toolName}: ${authorization.reason}`, true);
    }

    if (!run.listedTools) {
      const listed = await actionProvider.listTools(run.runId, actionProvenance);

      if (!listed.ok) {
        await recordRunCompleted(run.runId, "error", listed.error.message);
        activeRun = undefined;
        return textToolResult(listed.error.message, true);
      }

      await safeRecord(listed.data.event);
      run.listedTools = true;
    }

    const result = await actionProvider.callTool({
      runId: run.runId,
      toolName,
      arguments: toolArguments,
      provenance: actionProvenance
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
        ? `ARI authorized and called ${toolName} on ${actionProvider.metadata.upstreamId} after ${String(run.contextScope.selectedCount)} selected context item(s) and ${String(run.contextScope.excludedCount)} excluded context item(s) were recorded.`
        : `ARI authorized ${toolName}, and the upstream tool returned an error.`
    );
    activeRun = undefined;

    if (result.data.result !== undefined) {
      return normalizeToolResult(result.data.result, result.data.status === "error");
    }

    return textToolResult(result.data.errorMessage ?? `The upstream provider could not call ${toolName}.`, true);
  });

  async function getContext(input: Record<string, unknown>): Promise<CallToolResult> {
    const parsed = contextRequestInputSchema.safeParse(input);

    if (!parsed.success) {
      return textToolResult(parsed.error.message, true);
    }

    if (!options.contextProvider) {
      return textToolResult(
        "ARI cannot provide context because no context provider is configured. Set ARI_CONTEXT_REGISTRY_PATH or inject a ContextProvider.",
        true
      );
    }

    if (parsed.data.requesterId && parsed.data.requesterId !== options.identity.principalId) {
      return textToolResult("The requested requesterId does not match this gateway's trusted principal.", true);
    }

    if (parsed.data.purpose && parsed.data.purpose !== options.identity.purpose) {
      return textToolResult("The requested purpose does not match this gateway's configured purpose.", true);
    }

    const request: ContextRequest = {
      task: parsed.data.task,
      requesterId: options.identity.principalId,
      purpose: options.identity.purpose,
      ...(parsed.data.title ? { title: parsed.data.title } : {})
    };
    const run = await ensureRun(parsed.data.title ?? parsed.data.task);
    clearIdleCompletion(run);
    const requester = await options.contextProvider.getRequesterSnapshot(request.requesterId);

    if (!requester) {
      await recordRunCompleted(run.runId, "error", `No requester snapshot found for ${request.requesterId}.`);
      activeRun = undefined;
      return textToolResult(`No requester snapshot found for ${request.requesterId}.`, true);
    }

    const provenance: ToolCallProvenance = {
      permissionSnapshotId: `perm_${crypto.randomUUID()}`,
      contextDecisionId: `ctx_${crypto.randomUUID()}`
    };
    const sources = await options.contextProvider.getCandidateSources(request);
    const evaluated = permissionEvaluator.evaluate({
      request,
      requester,
      sources,
      provenance
    });

    run.contextScope = {
      title: parsed.data.title,
      principalId: requester.requesterId,
      principalScopes: requester.scopes,
      purpose: request.purpose,
      selectedCount: evaluated.selected.length,
      excludedCount: evaluated.excluded.length,
      selected: evaluated.selected.map((item) => ({
        sourceId: item.sourceId,
        sourceType: item.sourceType
      })),
      provenance
    };

    for (const item of evaluated.selected) {
      await safeRecord(contextEvent(run.runId, "context.selected", provenance, item));
    }

    for (const item of evaluated.excluded) {
      await safeRecord(contextEvent(run.runId, "context.excluded", provenance, item));
    }

    return textToolResult(JSON.stringify(contextResponse(evaluated), null, 2), false);
  }

  async function recordContextScope(input: Record<string, unknown>): Promise<CallToolResult> {
    const parsed = contextScopeInputSchema.safeParse(input);

    if (!parsed.success) {
      return textToolResult(parsed.error.message, true);
    }

    const run = await ensureRun(parsed.data.title);
    clearIdleCompletion(run);
    const provenance: ToolCallProvenance = {
      permissionSnapshotId: parsed.data.permissionSnapshotId ?? `perm_${crypto.randomUUID()}`,
      contextDecisionId: parsed.data.contextDecisionId ?? `ctx_${crypto.randomUUID()}`
    };

    run.contextScope = {
      title: parsed.data.title,
      principalId: options.identity.principalId,
      principalScopes: [],
      purpose: options.identity.purpose,
      selectedCount: parsed.data.selected.length,
      excludedCount: parsed.data.excluded.length,
      selected: parsed.data.selected.map((item) => ({
        sourceId: item.sourceId,
        sourceType: item.sourceType
      })),
      provenance
    };

    for (const item of parsed.data.selected) {
      await safeRecord(contextEvent(run.runId, "context.selected", provenance, item));
    }

    for (const item of parsed.data.excluded) {
      await safeRecord(contextEvent(run.runId, "context.excluded", provenance, item));
    }

    return textToolResult(
      `ARI recorded ${String(parsed.data.selected.length)} selected context item(s) and ${String(parsed.data.excluded.length)} excluded context item(s). Future upstream tool calls in this run will use context decision ${provenance.contextDecisionId}.`,
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
        userId: options.identity.principalId,
        scenario: `Retrieve permitted context for ${options.identity.purpose}, authorize one action, then forward it to ${actionProvider.metadata.upstreamId}.`
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

  server.onclose = () => {
    void actionProvider.close();
  };

  return server;
}

function ariTools(allowAgentDeclaredContext: boolean): ListToolsResult["tools"] {
  return allowAgentDeclaredContext ? [ariGetContextTool(), ariContextScopeTool()] : [ariGetContextTool()];
}

function ariContextScopeTool(): ListToolsResult["tools"][number] {
  return {
    name: ARI_CONTEXT_SCOPE_TOOL_NAME,
    description:
      "Compatibility tool for recording externally selected context. Disabled unless the gateway operator explicitly enables agent-declared context.",
    inputSchema: {
      type: "object",
      required: ["selected"],
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

function ariGetContextTool(): ListToolsResult["tools"][number] {
  return {
    name: ARI_GET_CONTEXT_TOOL_NAME,
    description:
      "Ask ARI to retrieve context for this gateway's trusted principal and purpose, record exclusions, and bind the context decision to later authorized tool calls.",
    inputSchema: {
      type: "object",
      required: ["task"],
      properties: {
        title: {
          type: "string",
          description: "Human-readable title for this agent run."
        },
        task: {
          type: "string",
          description: "The task the agent is trying to complete."
        },
        requesterId: {
          type: "string",
          description: "Optional compatibility assertion. It must match the gateway's trusted principal."
        },
        purpose: {
          type: "string",
          description: "Optional compatibility assertion. It must match the gateway's configured purpose."
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
  item: z.infer<typeof contextItemSchema> | SelectedContext | ExcludedContext
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

function contextResponse(evaluated: EvaluatedContext): Record<string, unknown> {
  return {
    permissionSnapshotId: evaluated.provenance.permissionSnapshotId,
    contextDecisionId: evaluated.provenance.contextDecisionId,
    selected: evaluated.selected.map((item) => ({
      sourceId: item.sourceId,
      sourceType: item.sourceType,
      title: item.title,
      content: item.content,
      reason: item.reason,
      permissionRule: item.permissionRule
    })),
    excludedSummary: evaluated.excluded.map((item) => ({
      sourceId: item.sourceId,
      sourceType: item.sourceType,
      title: item.title,
      reason: item.reason,
      permissionRule: item.permissionRule
    }))
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
