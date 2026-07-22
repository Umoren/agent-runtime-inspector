import type { RunSummary, TraceEvent } from "@ari/core";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileLock2,
  Fingerprint,
  ShieldCheck,
  ShieldX,
  Wrench
} from "lucide-react";
import { formatDateTime, formatDuration, humanizeKey } from "../lib/format";
import type { RunMode } from "../lib/collector";
import { RawEvidenceLoader } from "./RawEvidenceLoader";

type ContextEvent = Extract<TraceEvent, { type: "context.selected" | "context.excluded" }>;
type ToolCalledEvent = Extract<TraceEvent, { type: "tool.called" }>;
type ToolCompletedEvent = Extract<TraceEvent, { type: "tool.completed" }>;
type AuthorizationEvent = Extract<TraceEvent, { type: "authorization.decided" }>;

export function RunAuditView({
  summary,
  events,
  mode
}: {
  summary: RunSummary;
  events: readonly TraceEvent[];
  mode: RunMode;
}) {
  const selected = events.filter((event): event is Extract<TraceEvent, { type: "context.selected" }> => event.type === "context.selected");
  const excluded = events.filter((event): event is Extract<TraceEvent, { type: "context.excluded" }> => event.type === "context.excluded");
  const listed = events.find((event): event is Extract<TraceEvent, { type: "tool.listed" }> => event.type === "tool.listed");
  const called = events.find((event): event is ToolCalledEvent => event.type === "tool.called");
  const completed = called
    ? events.find(
        (event): event is ToolCompletedEvent =>
          event.type === "tool.completed" && event.payload.correlationId === called.payload.correlationId
      )
    : undefined;
  const blocked = events.find((event): event is Extract<TraceEvent, { type: "tool.blocked" }> => event.type === "tool.blocked");
  const authorization = events.find((event): event is AuthorizationEvent => event.type === "authorization.decided");
  const contextEvidence = selected[0] ?? excluded[0];
  const provenance = authorization?.payload ?? called?.payload ?? contextEvidence?.payload;
  const verdict = getVerdict(summary, authorization, blocked, completed);
  const actionName = called ? readableToolName(called.payload.toolName) : blocked ? readableToolName(blocked.payload.toolName) : "No action recorded";

  return (
    <>
      <header className={`audit-verdict audit-verdict-${verdict.tone}`}>
        <div className="audit-verdict-mark" aria-hidden="true">
          {verdict.tone === "allowed" ? <ShieldCheck size={28} /> : verdict.tone === "blocked" ? <ShieldX size={28} /> : <CircleAlert size={28} />}
        </div>
        <div className="audit-verdict-copy">
          <div className="audit-eyebrow">{modeLabel(mode)} · {formatDateTime(summary.startedAt)}</div>
          <h1>{summary.title}</h1>
          <p>{verdictSummary(verdict.tone, selected.length, excluded.length, actionName, completed)}</p>
        </div>
        <div className="audit-verdict-status">
          <span>{verdict.label}</span>
          <small>{summary.totalEvents} evidence events</small>
        </div>
      </header>

      <section className="decision-flow" aria-label="Run decision chain">
        <DecisionStep
          icon={<Fingerprint size={18} />}
          label="Request"
          title="Context requested"
          detail="ARI evaluated the configured requester and purpose."
        />
        <FlowArrow />
        <DecisionStep
          icon={<FileCheck2 size={18} />}
          label="Context"
          title={`${String(selected.length)} used · ${String(excluded.length)} withheld`}
          detail="Only sources that passed the file and scope policies were returned."
        />
        <FlowArrow />
        <DecisionStep
          icon={verdict.tone === "blocked" ? <ShieldX size={18} /> : <ShieldCheck size={18} />}
          label="Authorization"
          title={authorization ? humanizeKey(authorization.payload.decision) : verdict.label}
          detail={authorization?.payload.reason ?? "No action authorization decision was recorded."}
        />
        <FlowArrow />
        <DecisionStep
          icon={<Wrench size={18} />}
          label="Action"
          title={actionName}
          detail={completed ? `${humanizeKey(completed.payload.status)} in ${formatDuration(completed.payload.latencyMs)}` : blocked?.payload.reason ?? "No completed tool call."}
        />
      </section>

      <div className="audit-layout">
        <div className="audit-primary">
          <section className="audit-section" id="evidence">
            <SectionHeading
              eyebrow="Evidence"
              title="What the agent could and could not use"
              description="ARI records both sides of the context decision so an auditor can reconstruct the boundary."
            />
            <div className="evidence-columns">
              <EvidenceGroup tone="selected" title="Available to the agent" icon={<FileCheck2 size={18} />} events={selected} />
              <EvidenceGroup tone="withheld" title="Withheld from the agent" icon={<FileLock2 size={18} />} events={excluded} />
            </div>
          </section>

          <section className="audit-section" id="action">
            <SectionHeading
              eyebrow="Execution"
              title={called ? readableToolName(called.payload.toolName) : "No tool call recorded"}
              description={actionDescription(called, blocked, completed)}
            />
            {called ? (
              <div className="execution-record">
                <div className="execution-row">
                  <div className="execution-icon"><Wrench size={18} /></div>
                  <div>
                    <strong>{called.payload.toolName}</strong>
                    <span>Called through {called.payload.upstreamId ?? "the configured upstream provider"}</span>
                  </div>
                  <div className={`execution-status execution-status-${completed?.payload.status ?? "running"}`}>
                    {completed?.payload.status ?? "running"}
                  </div>
                  <div className="execution-latency">
                    <Clock3 size={15} />
                    {completed ? formatDuration(completed.payload.latencyMs) : "In progress"}
                  </div>
                </div>
                <details className="sensitive-disclosure">
                  <summary><ChevronDown size={16} /> View input and potentially sensitive output</summary>
                  <div className="payload-columns">
                    <PayloadBlock label="Input" value={called.payload.arguments} />
                    {completed?.payload.result === undefined ? null : <PayloadBlock label="Output" value={completed.payload.result} />}
                  </div>
                </details>
              </div>
            ) : blocked ? (
              <div className="blocked-record"><ShieldX size={20} /><div><strong>{blocked.payload.toolName}</strong><p>{blocked.payload.reason}</p></div></div>
            ) : (
              <div className="quiet-empty">This run did not reach a tool call.</div>
            )}
          </section>

          <section className="audit-section audit-telemetry">
            <details>
              <summary><span><strong>Technical evidence</strong><small>Upstream inventory, lifecycle events and raw JSON</small></span><ChevronDown size={18} /></summary>
              <div className="telemetry-body">
                {listed ? (
                  <div className="inventory-note">
                    <strong>{listed.payload.toolCount ?? listed.payload.tools.length} tools reported by {listed.payload.upstreamId ?? "the upstream provider"}</strong>
                    <p>This inventory was recorded at the ARI proxy boundary. A downstream MCP client may apply an additional allowlist that ARI cannot currently observe.</p>
                  </div>
                ) : null}
                <RawEvidenceLoader runId={summary.runId} />
              </div>
            </details>
          </section>
        </div>

        <aside className="decision-record">
          <div className="decision-record-heading">
            <span>Decision record</span>
            <strong>{verdict.label}</strong>
          </div>
          <DecisionFact label="Context sources" value={`${String(selected.length)} selected / ${String(excluded.length)} withheld`} />
          {authorization ? <DecisionFact label="Principal" value={authorization.payload.principalId} /> : null}
          {authorization ? <DecisionFact label="Purpose" value={authorization.payload.purpose} /> : null}
          <DecisionFact label="Action" value={actionName} />
          <DecisionFact label="Result" value={completed?.payload.status ?? (blocked ? "blocked" : summary.status)} />
          {completed ? <DecisionFact label="Latency" value={formatDuration(completed.payload.latencyMs)} /> : null}
          <div className="decision-rule">
            <span>Applied rule</span>
            <p>{authorization?.payload.policyId ?? provenance?.authorizationRule ?? "No authorization policy recorded."}</p>
          </div>
          <details className="decision-ids">
            <summary>Decision identifiers <ChevronDown size={15} /></summary>
            <DecisionId label="Permission snapshot" value={provenance?.permissionSnapshotId} />
            <DecisionId label="Context decision" value={provenance?.contextDecisionId} />
            <DecisionId label="Authorization" value={provenance?.authorizationDecisionId} />
          </details>
        </aside>
      </div>
    </>
  );
}

function DecisionStep({ icon, label, title, detail }: { icon: React.ReactNode; label: string; title: string; detail: string }) {
  return (
    <div className="decision-step">
      <div className="decision-step-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function FlowArrow() {
  return <ArrowRight className="decision-arrow" aria-hidden="true" size={18} />;
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="audit-section-heading">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function EvidenceGroup({ tone, title, icon, events }: { tone: "selected" | "withheld"; title: string; icon: React.ReactNode; events: readonly ContextEvent[] }) {
  return (
    <div className={`evidence-group evidence-group-${tone}`}>
      <div className="evidence-group-heading"><span>{icon}{title}</span><strong>{events.length}</strong></div>
      <div className="evidence-list">
        {events.map((event) => (
          <article key={event.id}>
            <div className="evidence-status">{tone === "selected" ? <Check size={14} /> : <FileLock2 size={14} />}</div>
            <div>
              <strong>{event.payload.title}</strong>
              <p>{plainContextReason(event, tone)}</p>
            </div>
            <code>{event.payload.permissionRule}</code>
          </article>
        ))}
      </div>
    </div>
  );
}

function PayloadBlock({ label, value }: { label: string; value: unknown }) {
  return <div className="payload-block"><span>{label}</span><pre>{JSON.stringify(value, null, 2)}</pre></div>;
}

function DecisionFact({ label, value }: { label: string; value: string }) {
  return <div className="decision-fact"><span>{label}</span><strong>{value}</strong></div>;
}

function DecisionId({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return <div><span>{label}</span><code title={value}>{shortId(value)}</code></div>;
}

function getVerdict(
  summary: RunSummary,
  authorization: AuthorizationEvent | undefined,
  blocked: Extract<TraceEvent, { type: "tool.blocked" }> | undefined,
  completed: ToolCompletedEvent | undefined
): { label: string; tone: "allowed" | "blocked" | "pending" } {
  if (authorization?.payload.decision === "deny") return { label: "Blocked", tone: "blocked" };
  if (blocked || summary.status === "error" || completed?.payload.status === "error") return { label: blocked ? "Blocked" : "Failed", tone: "blocked" };
  if (authorization?.payload.decision === "allow" && summary.status === "success") return { label: "Allowed", tone: "allowed" };
  if (summary.status === "success") return { label: "Completed", tone: "allowed" };
  return { label: "In progress", tone: "pending" };
}

function verdictSummary(
  tone: "allowed" | "blocked" | "pending",
  selected: number,
  excluded: number,
  action: string,
  completed: ToolCompletedEvent | undefined
): string {
  if (tone === "blocked") return `${action} was stopped before a permitted completion. ${String(excluded)} context source${excluded === 1 ? " was" : "s were"} withheld.`;
  if (tone === "pending") return `${String(selected)} context source${selected === 1 ? " is" : "s are"} available and ${String(excluded)} withheld. The run has not completed.`;
  return `${String(selected)} approved source${selected === 1 ? " was" : "s were"} available, ${String(excluded)} ${excluded === 1 ? "was" : "were"} withheld, and ${action} completed${completed ? ` in ${formatDuration(completed.payload.latencyMs)}` : ""}.`;
}

function actionDescription(called: ToolCalledEvent | undefined, blocked: Extract<TraceEvent, { type: "tool.blocked" }> | undefined, completed: ToolCompletedEvent | undefined): string {
  if (blocked) return blocked.payload.reason;
  if (!called) return "No downstream action was recorded for this run.";
  if (!completed) return "The action was called after context evaluation and is still waiting for a recorded result.";
  return `ARI bound this ${completed.payload.status} result to the same context and authorization decisions shown above.`;
}

function plainContextReason(event: ContextEvent, tone: "selected" | "withheld"): string {
  if (tone === "selected") return "Passed the configured purpose and scope checks.";
  if (event.payload.permissionRule?.startsWith("requires ")) return `Required permission was missing: ${event.payload.permissionRule.slice("requires ".length)}.`;
  return event.payload.reason;
}

function readableToolName(value: string): string {
  const withoutNamespace = value.includes("__") ? value.split("__").slice(1).join("__") : value;
  return humanizeKey(withoutNamespace);
}

function shortId(value: string): string {
  return value.length > 24 ? `${value.slice(0, 16)}…${value.slice(-6)}` : value;
}

function modeLabel(mode: RunMode): string {
  if (mode === "mcp-proxy") return "MCP audit run";
  if (mode === "merge-action") return "Action audit run";
  if (mode === "model") return "Model audit run";
  return "Runtime audit";
}
