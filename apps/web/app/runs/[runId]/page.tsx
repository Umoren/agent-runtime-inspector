import Link from "next/link";
import { ArrowLeft, Home, PlayCircle } from "lucide-react";
import { RawEventLog } from "../../../src/components/RawEventLog";
import { PathPanel } from "../../../src/components/PathPanel";
import { RunSummaryPanel } from "../../../src/components/RunSummaryPanel";
import { WhatHappenedPanel } from "../../../src/components/WhatHappenedPanel";
import { buildDashboardModel, getRunEvents } from "../../../src/lib/collector";
import { Separator } from "../../../src/components/ui/separator";
import { Button } from "../../../src/components/ui/button";
import { Badge } from "../../../src/components/ui/badge";
import { loadMockRunAction } from "../../actions";

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
        <form action={loadMockRunAction}>
          <Button type="submit">
            <PlayCircle aria-hidden="true" size={16} />
            Load mock
          </Button>
        </form>
      </nav>

      <section className="hero">
        <div className="hero-meta">
          <div className="kicker">Agent run</div>
          <Badge>{modeLabel(dashboard.mode)}</Badge>
        </div>
        <h1>{dashboard.summary.title}</h1>
        <p>
          Read the summary first, then inspect the context, action, model, and system events behind the run.
        </p>
      </section>

      <RunSummaryPanel summary={dashboard.summary} />

      <WhatHappenedPanel explanation={dashboard.explanation} />

      <Separator className="section" />

      <section className="grid grid-3 section">
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

function modeLabel(mode: "mock" | "connected" | "unknown"): string {
  if (mode === "mock") {
    return "mock mode";
  }

  if (mode === "connected") {
    return "live Merge mode";
  }

  return "unknown mode";
}
