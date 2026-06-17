import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";
import { RawEventLog } from "../../../src/components/RawEventLog";
import { PathPanel } from "../../../src/components/PathPanel";
import { RunSummaryPanel } from "../../../src/components/RunSummaryPanel";
import { PermissionAuditChain } from "../../../src/components/PermissionAuditChain";
import { buildDashboardModel, getRunEvents, type RunMode } from "../../../src/lib/collector";
import { Separator } from "../../../src/components/ui/separator";
import { Button } from "../../../src/components/ui/button";
import { Badge } from "../../../src/components/ui/badge";

export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const events = await getRunEvents(runId);
  const dashboard = buildDashboardModel(events);

  return (
    <main className="shell">
      <nav className="top-nav">
        <div className="nav-actions">
          <Button asChild className="button-secondary">
            <Link href="/#runs">
              <ArrowLeft aria-hidden="true" size={16} />
              Back to runs
            </Link>
          </Button>
          <Button asChild className="button-secondary">
            <Link href="/">
              <Home aria-hidden="true" size={16} />
              Home
            </Link>
          </Button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-meta">
          <div className="kicker">Agent run</div>
          <Badge>{modeLabel(dashboard.mode)}</Badge>
        </div>
        <h1>{dashboard.summary.title}</h1>
        <p>What context was allowed, what was withheld, which tool ran, and why that call was permitted.</p>
      </section>

      <RunSummaryPanel summary={dashboard.summary} />

      <PermissionAuditChain events={dashboard.raw} />

      <Separator className="section" />

      <section className="path-stack section">
        <PathPanel path="context" events={dashboard.grouped.context} />
        <PathPanel path="action" events={dashboard.grouped.action} />
        <PathPanel path="model" events={dashboard.grouped.model} />
      </section>

      <section className="section">
        <PathPanel path="system" events={dashboard.grouped.system} />
      </section>

      <RawEventLog events={dashboard.raw} />
    </main>
  );
}

function modeLabel(mode: RunMode): string {
  if (mode === "mcp-proxy") {
    return "MCP proxy run";
  }

  if (mode === "merge-action") {
    return "Merge action run";
  }

  if (mode === "model") {
    return "model run";
  }

  return "collector run";
}
