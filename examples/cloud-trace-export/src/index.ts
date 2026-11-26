import { context, trace, type Attributes } from "@opentelemetry/api";
import { TraceExporter } from "@google-cloud/opentelemetry-cloud-trace-exporter";
import { traceEventListSchema, type RunSummary, type TraceEvent } from "@ari/core";
import { ExportResultCode } from "@opentelemetry/core";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan
} from "@opentelemetry/sdk-trace-base";
import { cloudTraceFailureMessage } from "./export-error.js";
import { cloudTraceTimestampIssue } from "./cloud-trace-window.js";
import { toSpans, type RunSpans, type SpanDefinition } from "./to-spans.js";

const collectorUrl = process.env.ARI_COLLECTOR_URL ?? "http://localhost:4319";

class CliError extends Error {}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof CliError ? error.message : "Cloud Trace export failed.");
  process.exitCode = 1;
}

async function main(args: string[]): Promise<void> {
  const options = parseArgs(args);
  const runId = options.runId ?? (await findLatestRunId());
  const events = await fetchRun(runId);
  const spans = toSpans(events);

  if (options.dryRun) {
    printDryRun(spans);
    return;
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT;

  if (!projectId) {
    throw new CliError("GOOGLE_CLOUD_PROJECT is required for Cloud Trace export. Use --dry-run to preview safely.");
  }

  const timestampIssue = cloudTraceTimestampIssue([spans.root, ...spans.events]);

  if (timestampIssue === "too-old") {
    throw new CliError("Cloud Trace only accepts spans from the past 14 days. Record a fresh run before exporting.");
  }

  if (timestampIssue === "too-far-ahead") {
    throw new CliError("Cloud Trace accepts spans up to 3 days in the future. Check the machine clock.");
  }

  const traceId = await exportRun(spans, projectId);
  console.log(`Exported trace ${traceId}.`);
  console.log(`https://console.cloud.google.com/traces/list?project=${encodeURIComponent(projectId)}&tid=${traceId}`);
}

type CliOptions =
  | { runId: string; latest: false; dryRun: boolean }
  | { latest: true; dryRun: boolean; runId?: never };

type RunReference = Pick<RunSummary, "runId" | "startedAt">;

function parseArgs(args: string[]): CliOptions {
  const cliArgs = args[0] === "--" ? args.slice(1) : args;
  let runId: string | undefined;
  let latest = false;
  let dryRun = false;

  for (let index = 0; index < cliArgs.length; index += 1) {
    const arg = cliArgs[index];

    if (arg === "--run") {
      runId = cliArgs[index + 1];
      index += 1;
    } else if (arg === "--latest") {
      latest = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else {
      throw usageError();
    }
  }

  if (
    (runId === undefined && !latest) ||
    (runId !== undefined && latest) ||
    runId === "" ||
    runId?.startsWith("--")
  ) {
    throw usageError();
  }

  return runId === undefined ? { latest: true, dryRun } : { runId, latest: false, dryRun };
}

async function findLatestRunId(): Promise<string> {
  const response = await collectorFetch("/runs");

  if (!response.ok) {
    throw new CliError("The collector could not list runs.");
  }

  const body: unknown = await response.json();

  if (!Array.isArray(body)) {
    throw new CliError("The collector returned an invalid run list.");
  }

  const runs = body.filter(isRunSummary).sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  const latest = runs[0];

  if (!latest) {
    throw new CliError("The collector has no runs.");
  }

  return latest.runId;
}

async function fetchRun(runId: string): Promise<TraceEvent[]> {
  const response = await collectorFetch(`/runs/${encodeURIComponent(runId)}`);

  if (response.status === 404) {
    throw new CliError("Run not found.");
  }

  if (!response.ok) {
    throw new CliError("The collector could not read the run.");
  }

  const parsed = traceEventListSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new CliError("The collector returned invalid trace events. No spans were sent.");
  }

  return parsed.data;
}

async function collectorFetch(path: string): Promise<Response> {
  try {
    return await fetch(`${collectorUrl}${path}`);
  } catch {
    throw new CliError(`ARI collector is not running at ${collectorUrl}.`);
  }
}

function isRunSummary(value: unknown): value is RunReference {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "runId" in value && typeof value.runId === "string" && "startedAt" in value && typeof value.startedAt === "string";
}

function printDryRun(spans: RunSpans): void {
  printSpan(spans.root);

  for (const span of spans.events) {
    printSpan(span);
    console.log(
      `  kept ${String(span.fieldsKept ?? 0)} fields, kept ${String(span.fieldsKeptLocal ?? 0)} fields local`
    );
  }
}

function printSpan(span: SpanDefinition): void {
  console.log(`${span.name} (${String(span.endTime.getTime() - span.startTime.getTime())} ms)`);
  console.log(JSON.stringify(span.attributes, null, 2));
}

async function exportRun(spans: RunSpans, projectId: string): Promise<string> {
  const inMemoryExporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(inMemoryExporter)]
  });
  const tracer = provider.getTracer("ari-cloud-trace-export");
  const root = tracer.startSpan(spans.root.name, spanOptions(spans.root));
  const parentContext = trace.setSpan(context.active(), root);

  for (const definition of spans.events) {
    const span = tracer.startSpan(definition.name, spanOptions(definition), parentContext);
    span.setStatus(definition.status);
    span.end(definition.endTime);
  }

  root.setStatus(spans.root.status);
  root.end(spans.root.endTime);
  await provider.forceFlush();

  try {
    const finishedSpans = inMemoryExporter.getFinishedSpans();
    const traceId = root.spanContext().traceId;
    await exportBatch(finishedSpans, projectId);
    return traceId;
  } finally {
    await provider.shutdown();
  }
}

function spanOptions(span: SpanDefinition): { startTime: Date; attributes: Attributes } {
  return { startTime: span.startTime, attributes: span.attributes };
}

async function exportBatch(spans: ReadableSpan[], projectId: string): Promise<void> {
  // The demo requires direct Application Default Credentials export without a separate OTLP collector.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const exporter = new TraceExporter({ projectId });

  try {
    await new Promise<void>((resolve, reject) => {
      exporter
        .export(spans, (result) => {
          if (result.code === ExportResultCode.SUCCESS) {
            resolve();
          } else {
            reject(new CliError(cloudTraceFailureMessage(result.error)));
          }
        })
        .catch((error: unknown) => {
          reject(new CliError(cloudTraceFailureMessage(error)));
        });
    });
  } finally {
    await exporter.shutdown();
  }
}

function usageError(): CliError {
  return new CliError("Usage: --run <runId> [--dry-run] or --latest [--dry-run]");
}
