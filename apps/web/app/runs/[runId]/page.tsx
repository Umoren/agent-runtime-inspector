import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";
import { RunAuditView } from "../../../src/components/RunAuditView";
import { buildDashboardModel, getRunEvents } from "../../../src/lib/collector";
import { Button } from "../../../src/components/ui/button";

export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const events = await getRunEvents(runId);
  const dashboard = buildDashboardModel(events);

  return (
    <main className="audit-shell">
      <nav className="audit-nav">
        <Link className="audit-brand" href="/"><span>ARI</span><small>Agent Runtime Inspector</small></Link>
        <div className="nav-actions">
          <Button asChild className="button-secondary">
            <Link href="/#runs">
              <ArrowLeft aria-hidden="true" size={16} />
              Runs
            </Link>
          </Button>
          <Button asChild className="button-secondary audit-home-button">
            <Link href="/">
              <Home aria-hidden="true" size={16} />
              Home
            </Link>
          </Button>
        </div>
      </nav>

      <RunAuditView summary={dashboard.summary} events={dashboard.raw} mode={dashboard.mode} />
    </main>
  );
}
