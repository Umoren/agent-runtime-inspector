import Link from "next/link";
import { Plug } from "lucide-react";
import { type CollectorLogEntry, getRuns, getSummaryMode, getSystemStatus } from "../src/lib/collector";
import { formatDateTime } from "../src/lib/format";
import { Button } from "../src/components/ui/button";
import { Badge } from "../src/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../src/components/ui/card";
import { clearLocalTracesAction } from "./actions";

export default async function HomePage() {
  const [runs, status] = await Promise.all([getRuns(), getSystemStatus()]);
  const directToolVars = status.merge.optional.filter((item) => item.name.startsWith("MERGE_TOOL"));
  const githubWorkflowVars = status.merge.optional.filter((item) => item.name.startsWith("ARI_"));
  const visibleRuns = runs.slice(0, 3);
  const olderRuns = runs.slice(3);

  return (
    <main className="shell">
      <nav className="top-nav">
        <Link className="brand-link" href="/">
          Agent Runtime Inspector
        </Link>
        <div className="nav-actions">
          <Button asChild className="button-secondary">
            <Link href="#merge-setup">
              <Plug aria-hidden="true" size={16} />
              Merge setup
            </Link>
          </Button>
        </div>
      </nav>

      <section className="hero">
        <div className="kicker">Agent Runtime Inspector</div>
        <h1>Inspect what happened during an agent run.</h1>
        <p>
          See what the LLM knew, what the agent could do, which provider/model handled the request,
          and what got recorded for audit.
        </p>
      </section>

      <section className="grid grid-2 mode-grid" id="modes">
        <Card>
          <CardHeader>
            <CardTitle>Real MCP proxy path</CardTitle>
            <CardDescription>
              Connect an MCP-capable agent to ARI, record context scope, then forward tool calls through Merge Agent Handler.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="#merge-setup">Review setup</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card className="section" id="merge-setup">
        <details className="setup-panel">
          <summary className="disclosure-summary">
            <div>
              <CardTitle>Merge setup</CardTitle>
              <CardDescription>
                Check which environment variables are already set before running the connected example.
              </CardDescription>
            </div>
            <span className="disclosure-action disclosure-action-open">Hide setup</span>
            <span className="disclosure-action disclosure-action-closed">Show setup</span>
          </summary>
          <CardContent>
            <div className="setup-list setup-list-compact">
              <div className="setup-heading">Minimum Merge credentials</div>
              {status.merge.required.map((item) => (
                <EnvVarRow configured={item.configured} key={item.name} name={item.name} required />
              ))}
              <div className="setup-heading">Direct tool call</div>
              {directToolVars.map((item) => (
                <EnvVarRow configured={item.configured} key={item.name} name={item.name} />
              ))}
              <div className="setup-heading">GitHub issue workflow</div>
              {githubWorkflowVars.map((item) => (
                <EnvVarRow configured={item.configured} key={item.name} name={item.name} />
              ))}
              <div className="setup-heading">Live model provider</div>
              {status.model.required.map((item) => (
                <EnvVarRow configured={item.configured} key={item.name} name={item.name} />
              ))}
              {status.model.optional.map((item) => (
                <EnvVarRow configured={item.configured} key={item.name} name={item.name} />
              ))}
            </div>
          </CardContent>
        </details>
      </Card>

      <Card className="section">
        <CardHeader>
          <CardTitle>System status</CardTitle>
          <CardDescription>Use this to see whether the local inspector is ready before opening a run.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="status-strip">
            <StatusItem label="Collector" value={status.collector} tone={status.collector === "running" ? "good" : "bad"} />
            <StatusItem label="Storage" value={status.storage} />
            <StatusItem label="Merge" value={status.merge.state} tone={status.merge.state === "configured" ? "good" : "warn"} />
            <StatusItem label="Model" value={status.model.state} tone={status.model.state === "configured" ? "good" : "warn"} />
          </div>
          <p className="helper-text">Collector URL: {status.collectorUrl}</p>
        </CardContent>
      </Card>

      <Card className="section">
        <details className="setup-panel">
          <summary className="disclosure-summary">
            <div>
              <CardTitle>Collector diagnostics</CardTitle>
              <CardDescription>Recent collector health and storage events from the local runtime.</CardDescription>
            </div>
            <span className="disclosure-action disclosure-action-open">Hide diagnostics</span>
            <span className="disclosure-action disclosure-action-closed">Show diagnostics</span>
          </summary>
          <CardContent>
            <div className="status-strip">
              <StatusItem label="Health" value={status.collector} tone={collectorTone(status.collector)} />
              <StatusItem label="Storage read" value={status.collectorHealth?.storage.state ?? "unknown"} tone={status.collectorHealth?.storage.state === "unreadable" ? "bad" : "neutral"} />
              <StatusItem label="Errors" value={String(status.collectorHealth?.logCounts.error ?? 0)} tone={(status.collectorHealth?.logCounts.error ?? 0) > 0 ? "bad" : "good"} />
              <StatusItem label="Warnings" value={String(status.collectorHealth?.logCounts.warn ?? 0)} tone={(status.collectorHealth?.logCounts.warn ?? 0) > 0 ? "warn" : "good"} />
            </div>
            {status.collectorHealth?.latestError && status.collector === "degraded" ? (
              <div className="collector-latest-error">
                <div className="event-title">Latest collector error</div>
                <p>{status.collectorHealth.latestError.message}</p>
                <code>{status.collectorHealth.latestError.event}</code>
              </div>
            ) : null}
            <form action={clearLocalTracesAction} className="collector-actions">
              <Button type="submit" className="button-secondary">Clear local traces</Button>
              <p className="helper-text">Clears the local trace event store when stale or incompatible rows block run reads.</p>
            </form>
            <CollectorLogList logs={status.collectorLogs} />
          </CardContent>
        </details>
      </Card>

      <section className="grid grid-3">
        <Card>
          <CardHeader>
            <CardTitle>Context path</CardTitle>
            <CardDescription>Sources selected or excluded before the LLM response.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Action path</CardTitle>
            <CardDescription>Tools exposed to the agent, calls made, arguments sent, and results returned.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Model path</CardTitle>
            <CardDescription>Provider/model selection, status, latency, token use, cost, and fallback information when available.</CardDescription>
          </CardHeader>
        </Card>
      </section>

      <Card className="section" id="runs">
        <CardHeader>
          <CardTitle>Latest runs</CardTitle>
          <CardDescription>
            {runs.length === 0
              ? "No runs recorded yet."
              : `Showing ${String(visibleRuns.length)} of ${String(runs.length)} run${runs.length === 1 ? "" : "s"}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="empty-state">
              <div className="event-title">No runs recorded yet.</div>
              <p>
                Start the ARI MCP proxy, record context scope from an MCP-capable agent, then call a forwarded Merge tool.
              </p>
            </div>
          ) : (
            <>
              <RunList runs={visibleRuns} />
              {olderRuns.length > 0 ? (
                <details className="older-runs">
                  <summary className="disclosure-summary compact-disclosure-summary">
                    <div>
                      <CardTitle>Older runs</CardTitle>
                      <CardDescription>{olderRuns.length} older run{olderRuns.length === 1 ? "" : "s"} hidden.</CardDescription>
                    </div>
                    <span className="disclosure-action disclosure-action-open">Hide older runs</span>
                    <span className="disclosure-action disclosure-action-closed">Show older runs</span>
                  </summary>
                  <RunList runs={olderRuns} />
                </details>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function CollectorLogList({ logs }: { logs: readonly CollectorLogEntry[] }) {
  if (logs.length === 0) {
    return <p className="helper-text">No collector log entries recorded yet.</p>;
  }

  return (
    <div className="collector-log-list">
      {logs.map((entry) => (
        <article className="collector-log-row" key={entry.id}>
          <div className="collector-log-meta">
            <Badge className={`collector-log-level collector-log-${entry.level}`}>{entry.level}</Badge>
            <span>{formatDateTime(entry.timestamp)}</span>
          </div>
          <div className="event-title">{entry.message}</div>
          <code>{entry.event}</code>
          {entry.details ? <pre>{JSON.stringify(entry.details, null, 2)}</pre> : null}
        </article>
      ))}
    </div>
  );
}

function collectorTone(status: "running" | "degraded" | "unreachable"): "good" | "warn" | "bad" {
  if (status === "running") {
    return "good";
  }

  if (status === "degraded") {
    return "warn";
  }

  return "bad";
}

function RunList({ runs }: { runs: Awaited<ReturnType<typeof getRuns>> }) {
  return (
    <>
      {runs.map((run) => (
        <article className="event" key={run.runId}>
          <div className="event-badges">
            <Badge className="event-type">{getSummaryMode(run)}</Badge>
            <Badge className={run.status === "error" ? "status-error" : "status-success"}>{run.status}</Badge>
          </div>
          <div className="event-title">
            <Button asChild>
              <Link href={`/runs/${run.runId}`}>{run.title}</Link>
            </Button>
          </div>
          <div className="event-meta">
            {run.totalEvents} events · {formatDateTime(run.completedAt ?? run.startedAt)}
          </div>
        </article>
      ))}
    </>
  );
}

function StatusItem({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  return (
    <div className="status-item">
      <div className="status-label">{label}</div>
      <div className={`status-value status-${tone}`}>{value}</div>
    </div>
  );
}

function EnvVarRow({ configured, name, required = false }: { configured: boolean; name: string; required?: boolean }) {
  return (
    <div className="env-row">
      <code>{name}</code>
      <span className={configured ? "env-state env-configured" : "env-state env-missing"}>
        {configured ? "set" : required ? "required" : "optional"}
      </span>
    </div>
  );
}
