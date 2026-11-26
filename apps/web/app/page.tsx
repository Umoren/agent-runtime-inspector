import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Database,
  Settings2
} from "lucide-react";
import { type CollectorLogEntry, getRuns, getSummaryMode, getSystemStatus } from "../src/lib/collector";
import { formatDateTime, humanizeKey } from "../src/lib/format";
import { Button } from "../src/components/ui/button";
import { Badge } from "../src/components/ui/badge";
import { clearLocalTracesAction } from "./actions";

export default async function HomePage() {
  const [runs, status] = await Promise.all([getRuns(), getSystemStatus()]);

  return (
    <main className="console-shell">
      <nav className="audit-nav console-nav">
        <Link className="audit-brand" href="/"><span>ARI</span><small>Agent Runtime Inspector</small></Link>
        <div className="runtime-state">
          <span className={`runtime-dot runtime-dot-${collectorTone(status.collector)}`} />
          Collector {status.collector}
        </div>
      </nav>

      <header className="console-heading">
        <div>
          <span>Runtime evidence</span>
          <h1>Runs</h1>
          <p>{runs.length} recorded run{runs.length === 1 ? "" : "s"} in local SQLite storage.</p>
        </div>
        <div className="console-statuses">
          <SystemPill icon={<Activity size={15} />} label="Collector" value={status.collector} tone={collectorTone(status.collector)} />
          <SystemPill icon={<Database size={15} />} label="Storage" value="local" tone="good" />
          <SystemPill icon={<CheckCircle2 size={15} />} label="MCP upstream" value={status.upstream.state === "configured" ? "ready" : "setup needed"} tone={status.upstream.state === "configured" ? "good" : "warn"} />
          <SystemPill icon={<CheckCircle2 size={15} />} label="Policy" value={status.policy.state} tone={status.policy.state === "configured" ? "good" : "warn"} />
        </div>
      </header>

      <section className="run-index" id="runs">
        <div className="run-index-heading">
          <div>
            <span>Recent activity</span>
            <h2>Audit trail</h2>
          </div>
          <strong>{runs.length}</strong>
        </div>
        {runs.length === 0 ? (
          <div className="run-index-empty">
            <CircleAlert size={22} />
            <div><strong>No runs recorded</strong><p>The collector is ready for the first trace.</p></div>
          </div>
        ) : <RunList runs={runs} />}
      </section>

      <section className="operator-panel">
        <details>
          <summary>
            <span><Settings2 size={18} /><span><strong>Runtime configuration</strong><small>Connections, environment and collector diagnostics</small></span></span>
            <ChevronDown size={18} />
          </summary>
          <div className="operator-body">
            <div className="operator-grid">
              <ConfigGroup title="MCP upstream" items={[...status.upstream.required, ...status.upstream.optional]} />
              <ConfigGroup title="Policy engine" items={[...status.policy.required, ...status.policy.optional]} />
            </div>
            <div className="diagnostic-row">
              <StatusFact label="Storage read" value={status.collectorHealth?.storage.state ?? "unknown"} />
              <StatusFact label="Errors" value={String(status.collectorHealth?.logCounts.error ?? 0)} />
              <StatusFact label="Warnings" value={String(status.collectorHealth?.logCounts.warn ?? 0)} />
              <StatusFact label="Collector URL" value={status.collectorUrl} />
            </div>
            {status.collectorHealth?.latestError && status.collector === "degraded" ? (
              <div className="collector-latest-error"><strong>{status.collectorHealth.latestError.message}</strong><code>{status.collectorHealth.latestError.event}</code></div>
            ) : null}
            <CollectorLogList logs={status.collectorLogs} />
            <form action={clearLocalTracesAction} className="operator-actions">
              <Button type="submit" className="button-secondary">Clear local traces</Button>
            </form>
          </div>
        </details>
      </section>
    </main>
  );
}

function RunList({ runs }: { runs: Awaited<ReturnType<typeof getRuns>> }) {
  return (
    <div className="run-table">
      {runs.map((run) => {
        const contextCount = run.paths.context.totalEvents;
        const actionCount = run.paths.action.totalEvents;
        const modelCount = run.paths.model.totalEvents;

        return (
          <Link className="run-table-row" href={`/runs/${run.runId}`} key={run.runId}>
            <div className={`run-status-icon run-status-icon-${run.status}`}>
              {run.status === "success" ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}
            </div>
            <div className="run-main">
              <div className="run-title-line"><strong>{run.title}</strong><span>{humanizeKey(getSummaryMode(run))}</span></div>
              <div className="run-evidence-summary">
                {contextCount > 0 ? <span>{contextCount} context</span> : null}
                {actionCount > 0 ? <span>{actionCount} action</span> : null}
                {modelCount > 0 ? <span>{modelCount} model</span> : null}
                <span>{run.totalEvents} total events</span>
              </div>
            </div>
            <div className="run-time"><strong>{run.status}</strong><span>{formatDateTime(run.completedAt ?? run.startedAt)}</span></div>
            <ArrowUpRight aria-hidden="true" className="run-open" size={18} />
          </Link>
        );
      })}
    </div>
  );
}

function SystemPill({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "good" | "warn" | "bad" }) {
  return <div className={`system-pill system-pill-${tone}`}>{icon}<span>{label}</span><strong>{value}</strong></div>;
}

function ConfigGroup({ title, items }: { title: string; items: readonly { name: string; configured: boolean }[] }) {
  return (
    <div className="config-group">
      <h3>{title}</h3>
      {items.length === 0 ? <p>No variables in this group.</p> : items.map((item) => <EnvVarRow configured={item.configured} key={item.name} name={item.name} />)}
    </div>
  );
}

function EnvVarRow({ configured, name }: { configured: boolean; name: string }) {
  return <div className="config-row"><code>{name}</code><span className={configured ? "config-set" : "config-missing"}>{configured ? "set" : "unset"}</span></div>;
}

function StatusFact({ label, value }: { label: string; value: string }) {
  return <div className="status-fact"><span>{label}</span><strong>{value}</strong></div>;
}

function CollectorLogList({ logs }: { logs: readonly CollectorLogEntry[] }) {
  if (logs.length === 0) return null;

  return (
    <details className="collector-log-details">
      <summary>Recent collector logs <Badge>{logs.length}</Badge></summary>
      <div className="collector-log-list">
        {logs.map((entry) => (
          <article className="collector-log-row" key={entry.id}>
            <div className="collector-log-meta"><Badge className={`collector-log-level collector-log-${entry.level}`}>{entry.level}</Badge><span>{formatDateTime(entry.timestamp)}</span></div>
            <strong>{entry.message}</strong>
            <code>{entry.event}</code>
          </article>
        ))}
      </div>
    </details>
  );
}

function collectorTone(status: "running" | "degraded" | "unreachable"): "good" | "warn" | "bad" {
  if (status === "running") return "good";
  if (status === "degraded") return "warn";
  return "bad";
}
