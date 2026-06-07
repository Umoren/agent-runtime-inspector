import type { TraceEvent } from "@ari/core";

export function createModelCalledEvent(input: {
  runId: string;
  taskType: string;
  provider: string;
  model: string;
  routeReason?: string;
}): TraceEvent {
  return {
    id: crypto.randomUUID(),
    runId: input.runId,
    type: "model.called",
    path: "model",
    source: "ai-sdk",
    timestamp: new Date().toISOString(),
    payload: {
      taskType: input.taskType,
      provider: input.provider,
      model: input.model,
      ...(input.routeReason ? { routeReason: input.routeReason } : {})
    }
  };
}

export function createModelCompletedEvent(input: {
  runId: string;
  provider: string;
  model: string;
  status: "success" | "error";
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  errorMessage?: string;
}): TraceEvent {
  return {
    id: crypto.randomUUID(),
    runId: input.runId,
    type: "model.completed",
    path: "model",
    source: "ai-sdk",
    timestamp: new Date().toISOString(),
    payload: {
      provider: input.provider,
      model: input.model,
      status: input.status,
      latencyMs: input.latencyMs,
      ...(input.inputTokens === undefined ? {} : { inputTokens: input.inputTokens }),
      ...(input.outputTokens === undefined ? {} : { outputTokens: input.outputTokens }),
      ...(input.estimatedCostUsd === undefined ? {} : { estimatedCostUsd: input.estimatedCostUsd }),
      ...(input.errorMessage ? { errorMessage: input.errorMessage } : {})
    }
  };
}
