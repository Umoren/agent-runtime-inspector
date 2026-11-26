import type { SpanDefinition } from "./to-spans.js";

const maxPastMs = 14 * 24 * 60 * 60 * 1000;
const maxFutureMs = 3 * 24 * 60 * 60 * 1000;

export type CloudTraceTimestampIssue = "too-old" | "too-far-ahead";

export function cloudTraceTimestampIssue(
  spans: readonly SpanDefinition[],
  now = Date.now()
): CloudTraceTimestampIssue | undefined {
  const timestamps = spans.flatMap((span) => [span.startTime.getTime(), span.endTime.getTime()]);

  if (timestamps.some((timestamp) => timestamp < now - maxPastMs)) {
    return "too-old";
  }

  if (timestamps.some((timestamp) => timestamp > now + maxFutureMs)) {
    return "too-far-ahead";
  }

  return undefined;
}
