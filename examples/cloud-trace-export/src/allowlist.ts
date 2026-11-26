import type { Attributes } from "@opentelemetry/api";
import type { TraceEvent, TraceEventType } from "@ari/core";

const alwaysAllowed = ["type", "path", "runId", "timestamp"] as const;

const provenanceFields = [
  "contextDecisionId",
  "permissionSnapshotId",
  "authorizationDecisionId",
  "authorizationRule"
] as const;

export const allowedPayloadFields = {
  "run.started": ["scenario"],
  "context.selected": ["sourceType", "permissionRule"],
  "context.excluded": ["sourceType", "permissionRule"],
  "tool.listed": ["upstreamId", "upstreamType", "toolCount", "inventoryHash"],
  "tool.called": ["toolName", "upstreamId"],
  "tool.completed": ["toolName", "upstreamId", "status", "latencyMs"],
  "tool.blocked": ["toolName", "upstreamId", "policy"],
  "authorization.decided": ["toolName", "upstreamId", "decision", "policyId", "policyVersion"],
  "model.called": ["taskType", "provider", "model"],
  "model.completed": ["provider", "model", "status", "latencyMs", "inputTokens", "outputTokens"],
  "run.completed": ["status"]
} as const satisfies Record<TraceEventType, readonly string[]>;

export type AllowlistedEvent = {
  attributes: Attributes;
  fieldsKept: number;
  fieldsKeptLocal: number;
};

export function allowlistEvent(event: TraceEvent): AllowlistedEvent {
  const allowed = new Set<string>([...provenanceFields, ...allowedPayloadFields[event.type]]);
  const attributes: Attributes = {};
  let fieldsKept = 0;

  for (const field of alwaysAllowed) {
    attributes[toAttributeName(field)] = event[field];
  }

  for (const [field, value] of Object.entries(event.payload)) {
    if (allowed.has(field) && isAttributeValue(value)) {
      attributes[toAttributeName(field)] = value;
      fieldsKept += 1;
    }
  }

  const fieldsKeptLocal = Object.keys(event.payload).length - fieldsKept;
  attributes["ari.fields_kept_local"] = fieldsKeptLocal;

  return { attributes, fieldsKept, fieldsKeptLocal };
}

function toAttributeName(field: string): string {
  return `ari.${field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`;
}

function isAttributeValue(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
