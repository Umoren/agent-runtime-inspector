import type { Result, TraceEvent } from "@ari/core";
import { err, ok } from "@ari/core";
import type { MergeAgentHandlerConfig } from "./config.js";
import type { AgentHandlerTransport, AgentHandlerTool } from "./transport.js";

export type MergeAdapterError =
  | {
      code: "tool-list-failed";
      message: string;
    }
  | {
      code: "tool-call-failed";
      message: string;
    };

export type MergeAgentHandlerClient = {
  listTools(runId: string): Promise<Result<{ tools: AgentHandlerTool[]; event: TraceEvent }, MergeAdapterError>>;
  callTool(input: {
    runId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    correlationId?: string;
  }): Promise<Result<{ started: TraceEvent; completed: TraceEvent }, MergeAdapterError>>;
};

export function createMergeAgentHandlerClient(
  config: MergeAgentHandlerConfig,
  transport: AgentHandlerTransport
): MergeAgentHandlerClient {
  return {
    async listTools(runId) {
      try {
        const tools = await transport.listTools();
        return ok({
          tools,
          event: buildToolListedEvent({
            runId,
            registeredUserId: config.registeredUserId,
            toolPackId: config.toolPackId,
            tools
          })
        });
      } catch (error) {
        return err({
          code: "tool-list-failed",
          message: errorMessage(error)
        });
      }
    },
    async callTool(input) {
      const startedAt = performance.now();
      const correlationId = input.correlationId ?? crypto.randomUUID();
      const started = buildToolCalledEvent({
        runId: input.runId,
        toolName: input.toolName,
        toolPackId: config.toolPackId,
        registeredUserId: config.registeredUserId,
        arguments: input.arguments,
        correlationId
      });

      try {
        const result = await transport.callTool({
          name: input.toolName,
          arguments: input.arguments
        });
        const toolErrorMessage = toolResultErrorMessage(result);

        const completed = buildToolCompletedEvent({
          runId: input.runId,
          toolName: input.toolName,
          status: toolErrorMessage ? "error" : "success",
          latencyMs: elapsedMs(startedAt),
          result,
          ...(toolErrorMessage ? { errorMessage: toolErrorMessage } : {}),
          correlationId
        });

        return ok({ started, completed });
      } catch (error) {
        const completed = buildToolCompletedEvent({
          runId: input.runId,
          toolName: input.toolName,
          status: "error",
          latencyMs: elapsedMs(startedAt),
          errorMessage: errorMessage(error),
          correlationId
        });

        return ok({ started, completed });
      }
    }
  };
}

function buildToolListedEvent(input: {
  runId: string;
  registeredUserId: string;
  toolPackId: string;
  tools: readonly AgentHandlerTool[];
}): TraceEvent {
  return {
    id: crypto.randomUUID(),
    runId: input.runId,
    type: "tool.listed",
    path: "action",
    source: "merge",
    timestamp: new Date().toISOString(),
    payload: {
      registeredUserId: input.registeredUserId,
      toolPackId: input.toolPackId,
      tools: input.tools.map((tool) => ({
        name: tool.name,
        ...(tool.description ? { description: tool.description } : {}),
        ...(tool.inputSchema === undefined ? {} : { inputSchema: tool.inputSchema })
      }))
    }
  };
}

function buildToolCalledEvent(input: {
  runId: string;
  registeredUserId: string;
  toolPackId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  correlationId: string;
}): TraceEvent {
  return {
    id: crypto.randomUUID(),
    runId: input.runId,
    type: "tool.called",
    path: "action",
    source: "merge",
    timestamp: new Date().toISOString(),
    payload: {
      toolName: input.toolName,
      toolPackId: input.toolPackId,
      registeredUserId: input.registeredUserId,
      arguments: input.arguments,
      correlationId: input.correlationId
    }
  };
}

function buildToolCompletedEvent(input: {
  runId: string;
  toolName: string;
  status: "success" | "error";
  latencyMs: number;
  result?: unknown;
  errorMessage?: string;
  correlationId: string;
}): TraceEvent {
  return {
    id: crypto.randomUUID(),
    runId: input.runId,
    type: "tool.completed",
    path: "action",
    source: "merge",
    timestamp: new Date().toISOString(),
    payload: {
      toolName: input.toolName,
      status: input.status,
      latencyMs: input.latencyMs,
      ...(input.result === undefined ? {} : { result: input.result }),
      ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
      correlationId: input.correlationId
    }
  };
}

function elapsedMs(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown Merge Agent Handler error";
}

function toolResultErrorMessage(result: unknown): string | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }

  const candidate = result as {
    isError?: unknown;
    content?: unknown;
  };

  if (candidate.isError !== true) {
    return undefined;
  }

  const text = readTextContent(candidate.content);
  return text || "The tool returned an error.";
}

function readTextContent(content: unknown): string | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }

  const parts = content.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as {
      type?: unknown;
      text?: unknown;
    };

    if (candidate.type === "text" && typeof candidate.text === "string") {
      return [candidate.text];
    }

    return [];
  });

  return parts.join("\n").trim() || undefined;
}
