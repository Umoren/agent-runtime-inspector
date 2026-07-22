import { z } from "zod";

export const tracePathSchema = z.enum(["context", "action", "model", "system"]);
export const traceSourceSchema = z.enum(["merge", "mcp", "policy", "ai-sdk", "collector"]);

const baseTraceEventSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  timestamp: z.string().datetime(),
  path: tracePathSchema,
  source: traceSourceSchema
});

const provenanceIdsSchema = z.object({
  permissionSnapshotId: z.string().min(1).optional(),
  contextDecisionId: z.string().min(1).optional(),
  authorizationDecisionId: z.string().min(1).optional(),
  authorizationRule: z.string().min(1).optional()
});

export const runStartedEventSchema = baseTraceEventSchema.extend({
  type: z.literal("run.started"),
  path: z.literal("system"),
  payload: z.object({
    title: z.string().min(1),
    userId: z.string().optional(),
    scenario: z.string().optional()
  })
});

export const contextSelectedEventSchema = baseTraceEventSchema.extend({
  type: z.literal("context.selected"),
  path: z.literal("context"),
  payload: provenanceIdsSchema.extend({
    sourceId: z.string().min(1),
    sourceType: z.string().min(1),
    title: z.string().min(1),
    reason: z.string().min(1),
    permissionRule: z.string().optional()
  })
});

export const contextExcludedEventSchema = baseTraceEventSchema.extend({
  type: z.literal("context.excluded"),
  path: z.literal("context"),
  payload: provenanceIdsSchema.extend({
    sourceId: z.string().min(1),
    sourceType: z.string().min(1),
    title: z.string().min(1),
    reason: z.string().min(1),
    permissionRule: z.string().optional()
  })
});

export const toolListedEventSchema = baseTraceEventSchema.extend({
  type: z.literal("tool.listed"),
  path: z.literal("action"),
  payload: provenanceIdsSchema.extend({
    upstreamId: z.string().min(1).optional(),
    upstreamType: z.string().min(1).optional(),
    toolPackId: z.string().min(1).optional(),
    registeredUserId: z.string().min(1).optional(),
    toolCount: z.number().int().nonnegative().optional(),
    inventoryHash: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
    tools: z.array(
      z.object({
        name: z.string().min(1),
        risk: z.enum(["read", "write", "admin"]).optional()
      })
    )
  })
});

export const toolCalledEventSchema = baseTraceEventSchema.extend({
  type: z.literal("tool.called"),
  path: z.literal("action"),
  payload: provenanceIdsSchema.extend({
    toolName: z.string().min(1),
    upstreamId: z.string().min(1).optional(),
    toolPackId: z.string().min(1).optional(),
    registeredUserId: z.string().min(1).optional(),
    arguments: z.record(z.unknown()),
    correlationId: z.string().optional()
  })
});

export const toolCompletedEventSchema = baseTraceEventSchema.extend({
  type: z.literal("tool.completed"),
  path: z.literal("action"),
  payload: provenanceIdsSchema.extend({
    toolName: z.string().min(1),
    upstreamId: z.string().min(1).optional(),
    status: z.enum(["success", "error"]),
    latencyMs: z.number().nonnegative(),
    result: z.unknown().optional(),
    errorMessage: z.string().optional(),
    correlationId: z.string().optional()
  })
});

export const toolBlockedEventSchema = baseTraceEventSchema.extend({
  type: z.literal("tool.blocked"),
  path: z.literal("action"),
  payload: provenanceIdsSchema.extend({
    toolName: z.string().min(1),
    upstreamId: z.string().min(1).optional(),
    reason: z.string().min(1),
    policy: z.string().optional()
  })
});

export const authorizationDecidedEventSchema = baseTraceEventSchema.extend({
  type: z.literal("authorization.decided"),
  path: z.literal("action"),
  payload: provenanceIdsSchema.extend({
    authorizationDecisionId: z.string().min(1),
    principalId: z.string().min(1),
    purpose: z.string().min(1),
    upstreamId: z.string().min(1),
    toolName: z.string().min(1),
    decision: z.enum(["allow", "deny"]),
    reason: z.string().min(1),
    policyId: z.string().min(1),
    policyVersion: z.string().min(1).optional()
  })
});

export const modelCalledEventSchema = baseTraceEventSchema.extend({
  type: z.literal("model.called"),
  path: z.literal("model"),
  payload: z.object({
    taskType: z.string().min(1),
    provider: z.string().min(1),
    model: z.string().min(1),
    routeReason: z.string().optional()
  })
});

export const modelCompletedEventSchema = baseTraceEventSchema.extend({
  type: z.literal("model.completed"),
  path: z.literal("model"),
  payload: z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
    status: z.enum(["success", "error"]),
    latencyMs: z.number().nonnegative(),
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    estimatedCostUsd: z.number().nonnegative().optional(),
    errorMessage: z.string().optional()
  })
});

export const runCompletedEventSchema = baseTraceEventSchema.extend({
  type: z.literal("run.completed"),
  path: z.literal("system"),
  payload: z.object({
    status: z.enum(["success", "error"]),
    summary: z.string().optional()
  })
});

export const traceEventSchema = z.discriminatedUnion("type", [
  runStartedEventSchema,
  contextSelectedEventSchema,
  contextExcludedEventSchema,
  toolListedEventSchema,
  toolCalledEventSchema,
  toolCompletedEventSchema,
  toolBlockedEventSchema,
  authorizationDecidedEventSchema,
  modelCalledEventSchema,
  modelCompletedEventSchema,
  runCompletedEventSchema
]);

export const traceEventListSchema = z.array(traceEventSchema);

export type TracePath = z.infer<typeof tracePathSchema>;
export type TraceSource = z.infer<typeof traceSourceSchema>;
export type TraceEvent = z.infer<typeof traceEventSchema>;
export type TraceEventType = TraceEvent["type"];
