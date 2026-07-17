import type { TraceEvent } from "@ari/core";
import type { ReactNode } from "react";
import { formatDuration } from "../lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

type AuditChain = {
  selected: Extract<TraceEvent, { type: "context.selected" }>[];
  excluded: Extract<TraceEvent, { type: "context.excluded" }>[];
  listed: Extract<TraceEvent, { type: "tool.listed" }> | undefined;
  called: Extract<TraceEvent, { type: "tool.called" }> | undefined;
  completed: Extract<TraceEvent, { type: "tool.completed" }> | undefined;
};

export function PermissionAuditChain({ events }: { events: readonly TraceEvent[] }) {
  const chain = buildAuditChain(events);

  if (!chain.called && chain.selected.length === 0 && chain.excluded.length === 0) {
    return null;
  }

  return (
    <Card className="section audit-chain">
      <CardHeader>
        <CardTitle>Permission scope and action record</CardTitle>
        <CardDescription>Allowed context -&gt; excluded context -&gt; tool call -&gt; permission reason -&gt; logged result.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="audit-chain-grid">
          <AuditBlock label="Allowed context" value={`${String(chain.selected.length)} item${chain.selected.length === 1 ? "" : "s"}`}>
            <ContextList events={chain.selected} empty="No selected context recorded." />
          </AuditBlock>

          <AuditBlock label="Excluded context" value={`${String(chain.excluded.length)} item${chain.excluded.length === 1 ? "" : "s"}`}>
            <ContextList events={chain.excluded} empty="No excluded context recorded." />
          </AuditBlock>

          <AuditBlock label="Tool scope" value={chain.listed ? `${String(chain.listed.payload.toolCount ?? chain.listed.payload.tools.length)} tools` : "not listed"}>
            {chain.listed ? (
              <div className="audit-facts">
                <Fact label="Tool Pack" value={chain.listed.payload.toolPackId} />
                <Fact label="Registered User" value={chain.listed.payload.registeredUserId} />
              </div>
            ) : (
              <p>No scoped tool inventory recorded.</p>
            )}
          </AuditBlock>

          <AuditBlock label="Action" value={chain.called?.payload.toolName ?? "not called"}>
            {chain.called ? (
              <div className="audit-facts">
                <Fact label="Authorization" value={chain.called.payload.authorizationRule ?? "No rule recorded."} />
                <Fact label="Context decision" value={chain.called.payload.contextDecisionId ?? "No context decision recorded."} />
                <Fact label="Arguments" value={JSON.stringify(chain.called.payload.arguments)} />
              </div>
            ) : (
              <p>No tool call recorded.</p>
            )}
          </AuditBlock>
        </div>

        {chain.completed ? (
          <div className="audit-result">
            <strong>{chain.completed.payload.status}</strong>
            <span>{formatDuration(chain.completed.payload.latencyMs)}</span>
            {chain.completed.payload.errorMessage ? <p>{chain.completed.payload.errorMessage}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AuditBlock({
  label,
  value,
  children
}: {
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <section className="audit-block">
      <div className="audit-heading">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {children}
    </section>
  );
}

function ContextList({
  events,
  empty
}: {
  events: readonly Extract<TraceEvent, { type: "context.selected" | "context.excluded" }>[];
  empty: string;
}) {
  if (events.length === 0) {
    return <p>{empty}</p>;
  }

  return (
    <div className="audit-context-list">
      {events.map((event) => (
        <article key={event.id}>
          <strong>{event.payload.title}</strong>
          <p>{event.payload.permissionRule}</p>
        </article>
      ))}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="audit-fact">
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}

function buildAuditChain(events: readonly TraceEvent[]): AuditChain {
  const selected = events.filter((event): event is Extract<TraceEvent, { type: "context.selected" }> => event.type === "context.selected");
  const excluded = events.filter((event): event is Extract<TraceEvent, { type: "context.excluded" }> => event.type === "context.excluded");
  const listed = events.find((event): event is Extract<TraceEvent, { type: "tool.listed" }> => event.type === "tool.listed");
  const called = events.find((event): event is Extract<TraceEvent, { type: "tool.called" }> => event.type === "tool.called");
  const completed = called
    ? events.find(
        (event): event is Extract<TraceEvent, { type: "tool.completed" }> =>
          event.type === "tool.completed" && event.payload.correlationId === called.payload.correlationId
      )
    : undefined;

  return {
    selected,
    excluded,
    listed,
    called,
    completed
  };
}
