# ARI Cloud Trace allowlist exporter

ARI keeps the complete agent trace on the local machine. This example sends a small allowlist of safe event fields to Google Cloud Trace.

The export includes event types, paths, timestamps, status values, tool and model names, latency values, policy metadata, and decision IDs. It does not include prompts, context titles, reasons, tool arguments, tool results, identities, summaries, or other free text. Each event span includes `ari.fields_kept_local`, which counts the payload fields that the exporter dropped.

## Run a safe preview

Start the ARI collector and record a run. Then run one of these commands:

```bash
pnpm --filter @ari/example-cloud-trace-export dev -- --run <runId> --dry-run
pnpm --filter @ari/example-cloud-trace-export dev -- --latest --dry-run
```

The preview prints only allowlisted span data. It sends nothing.

## Send to Google Cloud Trace

Enable the Cloud Trace API and authenticate with Application Default Credentials:

```bash
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT=<project-id>
pnpm --filter @ari/example-cloud-trace-export dev -- --run <runId>
```

Set `ARI_COLLECTOR_URL` if the collector is not at `http://localhost:4319`.

This demo uses `@google-cloud/opentelemetry-cloud-trace-exporter` for direct export. Google has deprecated that package in favor of OpenTelemetry Protocol (OTLP) export through the Telemetry API. The direct exporter keeps this local demo small and uses Application Default Credentials without a separate collector.
