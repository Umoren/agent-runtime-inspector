import type { CallToolResult, ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { TraceEvent } from "@ari/core";
import { createHttpRecorder } from "@ari/ai-sdk";
import {
  createMcpSdkTransport,
  createMergeAgentHandlerClient,
  type MergeAgentHandlerConfig
} from "@ari/merge";

type ProxyServerOptions = {
  collectorUrl: string;
  merge: MergeAgentHandlerConfig;
};

type ActiveRun = {
  runId: string;
  listedTools: boolean;
  idleTimer: NodeJS.Timeout | undefined;
};

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
    const run = await ensureRun();
    const result = await merge.listTools(run.runId);

    if (!result.ok) {
      await recordRunCompleted(run.runId, "error", result.error.message);
      activeRun = undefined;
      return {
        tools: [],
        _meta: {
          ariError: result.error.message
        }
      };
    }

    await safeRecord(result.data.event);
    run.listedTools = true;
    scheduleListOnlyCompletion(run, result.data.tools.length);

    return {
      tools: result.data.tools.map((tool) => ({
        name: tool.name,
        ...(tool.description ? { description: tool.description } : {}),
        inputSchema: normalizeInputSchema(tool.inputSchema)
      }))
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const run = await ensureRun();
    clearIdleCompletion(run);

    if (!run.listedTools) {
      const listed = await merge.listTools(run.runId);

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
      arguments: toolArguments
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
        ? `Merge Agent Handler called ${toolName}.`
        : `Merge Agent Handler called ${toolName}, and the tool returned an error.`
    );
    activeRun = undefined;

    if (result.data.result !== undefined) {
      return normalizeToolResult(result.data.result, result.data.status === "error");
    }

    return textToolResult(result.data.errorMessage ?? `Merge Agent Handler could not call ${toolName}.`, true);
  });

  async function ensureRun(): Promise<ActiveRun> {
    if (activeRun) {
      return activeRun;
    }

    const run: ActiveRun = {
      runId: `run_${crypto.randomUUID()}`,
      listedTools: false,
      idleTimer: undefined
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
        title: "ARI MCP proxy run",
        scenario: "Forward one MCP tool list and tool call through Merge Agent Handler."
      }
    });

    return run;
  }

  function scheduleListOnlyCompletion(run: ActiveRun, toolsCount: number): void {
    clearIdleCompletion(run);
    run.idleTimer = setTimeout(async () => {
      if (activeRun?.runId !== run.runId) {
        return;
      }

      await recordRunCompleted(
        run.runId,
        "success",
        `Merge Agent Handler listed ${String(toolsCount)} tools. No tool call followed in this MCP session.`
      );
      activeRun = undefined;
    }, 5_000);
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
