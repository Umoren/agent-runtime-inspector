import Link from "next/link";
import { PlayCircle, Plug } from "lucide-react";
import { getRuns, getSummaryMode, getSystemStatus } from "../src/lib/collector";
import { formatDateTime } from "../src/lib/format";
import { Button } from "../src/components/ui/button";
import { Badge } from "../src/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../src/components/ui/card";
import { loadMockRunAction } from "./actions";

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
          <form action={loadMockRunAction}>
            <Button type="submit">
              <PlayCircle aria-hidden="true" size={16} />
              Load mock
            </Button>
          </form>
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
            <CardTitle>Mock mode</CardTitle>
            <CardDescription>
              Load a complete trace so you can see context selection, tool execution, model routing, and audit logs without setup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={loadMockRunAction}>
              <Button type="submit">Load mock run</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Live Merge mode</CardTitle>
            <CardDescription>
              Add Merge credentials first. Then choose either a direct tool call or the GitHub issue workflow.
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
            <StatusItem label="Mock trace" value={status.mockTrace} tone="good" />
          </div>
          <p className="helper-text">Collector URL: {status.collectorUrl}</p>
        </CardContent>
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
          <CardDescription>{runs.length === 0 ? "No runs recorded yet." : `Showing ${visibleRuns.length} of ${runs.length} run${runs.length === 1 ? "" : "s"}.`}</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="empty-state">
              <div className="event-title">No runs recorded yet.</div>
              <p>
                Load the mock run to see a complete trace, or run a connected Merge Agent Handler example to record a new run.
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
