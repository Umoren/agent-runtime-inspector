import { spawn } from "node:child_process";
import { mockTraceEvents } from "@ari/core";
import { startCollector } from "@ari/collector";
import { runProxyServer } from "@ari/proxy";
import { readConfig, writeDefaultConfig } from "./config.js";

export async function runInitCommand(): Promise<void> {
  const result = await writeDefaultConfig();

  if (!result.ok) {
    console.error(result.error);
    process.exitCode = 1;
    return;
  }

  console.log("Created ari.config.json");
}

export async function runMockCommand(): Promise<void> {
  const config = await readConfig();

  if (!config.ok) {
    console.error(config.error);
    process.exitCode = 1;
    return;
  }

  const response = await fetch(`${config.data.collectorUrl}/events/batch`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(mockTraceEvents)
  });

  if (!response.ok) {
    console.error(`Collector rejected mock trace: ${response.status} ${response.statusText}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Loaded mock trace: ${mockTraceEvents[0]?.runId ?? "unknown-run"}`);
  console.log(`${config.data.dashboardUrl}/runs/${mockTraceEvents[0]?.runId ?? ""}`);
}

export async function runReplayCommand(runId: string | undefined): Promise<void> {
  if (!runId) {
    console.error("Usage: ari replay <runId>");
    process.exitCode = 1;
    return;
  }

  const config = await readConfig();

  if (!config.ok) {
    console.error(config.error);
    process.exitCode = 1;
    return;
  }

  console.log(`${config.data.dashboardUrl}/runs/${runId}`);
}

export async function runDevCommand(): Promise<void> {
  const collector = startCollector({ port: 4319 });
  const dashboard = spawn("pnpm", ["--filter", "@ari/web", "dev"], {
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  console.log("Collector listening on http://localhost:4319");
  console.log("Dashboard starting on http://localhost:3005");

  process.on("SIGINT", () => {
    collector.close();
    dashboard.kill("SIGINT");
    process.exit(0);
  });
}

export async function runProxyCommand(): Promise<void> {
  await runProxyServer();
}
