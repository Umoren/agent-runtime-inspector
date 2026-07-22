import type { TraceEvent, TracePath } from "@ari/core";
import { formatDateTime, formatDuration, humanizeKey } from "../lib/format";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

const pathCopy: Record<TracePath, string> = {
  context: "Files considered before action.",
  action: "Tools exposed, called, and completed.",
  model: "Provider activity captured for this run.",
  system: "Run lifecycle"
};

export function PathPanel({ path, events }: { path: TracePath; events: readonly TraceEvent[] }) {
  if (path === "system") {
    return (
      <Card className="path-card path-card-system">
        <details className="system-events-panel">
          <summary className="disclosure-summary">
            <div>
              <CardTitle>{pathLabel(path)}</CardTitle>
              <CardDescription>{pathCopy[path]}</CardDescription>
            </div>
            <span className="disclosure-action disclosure-action-open">Hide events</span>
            <span className="disclosure-action disclosure-action-closed">Show events</span>
          </summary>
          <CardContent>
            <PathContent path={path} events={events} />
          </CardContent>
        </details>
      </Card>
    );
  }

  return (
    <Card className={`path-card path-card-${path}`}>
      <CardHeader>
        <CardTitle>{pathLabel(path)}</CardTitle>
        <CardDescription>{pathCopy[path]}</CardDescription>
      </CardHeader>
      <CardContent>
        <PathContent path={path} events={events} />
      </CardContent>
    </Card>
  );
}

function PathContent({ path, events }: { path: TracePath; events: readonly TraceEvent[] }) {
  if (events.length === 0) {
    return <EmptyPathState path={path} />;
  }

  if (path === "context") {
    return <ContextPath events={events} />;
  }

  if (path === "action") {
    return <ActionPath events={events} />;
  }

  if (path === "model") {
    return <ModelPath events={events} />;
  }

  return events.map((event) => (
    <article className="event" key={event.id}>
      <Badge className="event-type">{event.type}</Badge>
      <div className="event-title">{eventTitle(event)}</div>
      <div className="event-meta">
        {event.source} · {formatDateTime(event.timestamp)}
      </div>
      <EventDetail event={event} />
    </article>
  ));
}

function ContextPath({ events }: { events: readonly TraceEvent[] }) {
  const selected = events.filter((event): event is Extract<TraceEvent, { type: "context.selected" }> => event.type === "context.selected");
  const excluded = events.filter((event): event is Extract<TraceEvent, { type: "context.excluded" }> => event.type === "context.excluded");

  return (
    <div className="path-groups">
      <ContextGroup title="Read" events={selected} />
      <ContextGroup title="Held back" events={excluded} />
    </div>
  );
}

function ContextGroup({
  title,
  events
}: {
  title: string;
  events: readonly Extract<TraceEvent, { type: "context.selected" | "context.excluded" }>[];
}) {
  return (
    <section className="path-group">
      <div className="path-group-heading">
        <span>{title}</span>
        <strong>{String(events.length)}</strong>
      </div>
      <div className="source-table">
        {events.map((event) => (
          <article className="source-row" key={event.id}>
            <div>
              <div className="path-row-title">{event.payload.title}</div>
              <p>{event.payload.reason}</p>
            </div>
            <span>{event.payload.permissionRule ?? humanizeKey(event.payload.sourceType)}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActionPath({ events }: { events: readonly TraceEvent[] }) {
  const inventory = events.find((event): event is Extract<TraceEvent, { type: "tool.listed" }> => event.type === "tool.listed");
  const calls = events.filter((event): event is Extract<TraceEvent, { type: "tool.called" }> => event.type === "tool.called");
  const completed = events.filter((event): event is Extract<TraceEvent, { type: "tool.completed" }> => event.type === "tool.completed");
  const blocked = events.filter((event): event is Extract<TraceEvent, { type: "tool.blocked" }> => event.type === "tool.blocked");
  const decisions = events.filter((event): event is Extract<TraceEvent, { type: "authorization.decided" }> => event.type === "authorization.decided");

  return (
    <div className="path-groups">
      {decisions.map((event) => (
        <article className="path-row" key={event.id}>
          <div className={`path-status ${event.payload.decision === "allow" ? "path-status-good" : "path-status-bad"}`}>{event.payload.decision}</div>
          <div className="path-row-main">
            <div className="path-row-title">{event.payload.policyId}</div>
            <p>{event.payload.reason}</p>
            <div className="path-row-meta"><span>{event.payload.principalId}</span><span>{event.payload.purpose}</span><span>{event.payload.authorizationDecisionId}</span></div>
          </div>
        </article>
      ))}
      {inventory ? (
        <section className="path-group">
          <div className="path-group-heading">
            <span>Available</span>
            <strong>{String(inventory.payload.toolCount ?? inventory.payload.tools.length)}</strong>
          </div>
          <div className="tool-inventory">
            <div className="path-row-title">Scoped tools</div>
            <p>
              ARI recorded {String(inventory.payload.toolCount ?? inventory.payload.tools.length)} tools reported by {inventory.payload.upstreamId ?? "the configured upstream provider"}.
            </p>
            <ToolInventory tools={inventory.payload.tools} />
          </div>
        </section>
      ) : null}

      <section className="path-group">
        <div className="path-group-heading">
          <span>Execution</span>
          <strong>{String(calls.length)}</strong>
        </div>
        <div className="path-sequence">
          {calls.map((call, index) => {
            const result = completed.find((event) => event.payload.correlationId === call.payload.correlationId);
            const status = result?.payload.status ?? "running";

            return (
              <article className="trail-row" key={call.id}>
                <div className="trail-index">{String(index + 1).padStart(2, "0")}</div>
                <div className="path-row-main">
                  <div className="trail-heading">
                    <div className="path-row-title">{call.payload.toolName}</div>
                    <span className={status === "success" ? "trail-status trail-status-good" : status === "error" ? "trail-status trail-status-bad" : "trail-status"}>
                      {status}
                    </span>
                  </div>
                  <p>{actionSummary(call.payload.toolName, result)}</p>
                  <div className="path-row-meta">
                    {result ? <span>{formatDuration(result.payload.latencyMs)}</span> : null}
                    {call.payload.contextDecisionId ? <span>{call.payload.contextDecisionId}</span> : null}
                    {call.payload.authorizationDecisionId ? <span>{call.payload.authorizationDecisionId}</span> : null}
                    {call.payload.authorizationRule ? <span>{call.payload.authorizationRule}</span> : null}
                  </div>
                  <details className="path-row-detail">
                    <summary>Payload</summary>
                    <div className="path-detail-grid">
                      <div>
                        <div className="event-subheading">Input</div>
                        <PayloadView value={call.payload.arguments} />
                      </div>
                      {result?.payload.result === undefined ? null : (
                        <div>
                          <div className="event-subheading">Output</div>
                          <PayloadView value={result.payload.result} />
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {blocked.map((event) => (
        <article className="path-row" key={event.id}>
          <div className="path-status path-status-bad">blocked</div>
          <div className="path-row-main">
            <div className="path-row-title">{event.payload.toolName}</div>
            <p>{event.payload.reason}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function ToolInventory({ tools }: { tools: readonly { name: string; description?: string | undefined }[] }) {
  const preview = tools.slice(0, 12);
  const remaining = tools.length - preview.length;

  return (
    <div className="tool-inventory-list">
      <div className="path-row-meta">
        {preview.map((tool) => (
          <span key={tool.name}>{tool.name}</span>
        ))}
      </div>
      {remaining > 0 ? (
        <details className="path-row-detail tool-inventory-details">
          <summary>Show all scoped tools ({String(tools.length)})</summary>
          <div className="path-row-meta">
            {tools.map((tool) => (
              <span key={tool.name}>{tool.name}</span>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ModelPath({ events }: { events: readonly TraceEvent[] }) {
  const modelEvents = events.filter(
    (event): event is Extract<TraceEvent, { type: "model.called" | "model.completed" }> =>
      event.type === "model.called" || event.type === "model.completed"
  );

  if (modelEvents.length === 0) {
    return <EmptyPathState path="model" />;
  }

  return (
    <div className="path-timeline">
      {modelEvents.map((event) => (
        <article className="path-row" key={event.id}>
          <div className={`path-status ${event.type === "model.completed" && event.payload.status === "success" ? "path-status-good" : ""}`}>
            {event.type === "model.called" ? "called" : event.payload.status}
          </div>
          <div className="path-row-main">
            <div className="path-row-title">
              {event.payload.provider}/{event.payload.model}
            </div>
            <p>{event.type === "model.called" ? event.payload.routeReason ?? event.payload.taskType : modelSummary(event.payload)}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function pathLabel(path: TracePath): string {
  if (path === "context") return "Context";
  if (path === "action") return "Actions";
  if (path === "model") return "Model";
  return "System events";
}

function eventTitle(event: TraceEvent): string {
  switch (event.type) {
    case "run.started":
      return event.payload.title;
    case "context.selected":
    case "context.excluded":
      return event.payload.title;
    case "tool.listed":
      return "Tool inventory fetched";
    case "tool.called":
    case "tool.completed":
    case "tool.blocked":
      return event.payload.toolName;
    case "authorization.decided":
      return `${event.payload.decision}: ${event.payload.toolName}`;
    case "model.called":
    case "model.completed":
      return `${event.payload.provider}/${event.payload.model}`;
    case "run.completed":
      return event.payload.summary ?? event.payload.status;
  }
}

function EmptyPathState({ path }: { path: TracePath }) {
  const copy = emptyStateCopy(path);

  return (
    <div className="empty-state">
      <div className="event-title">{copy.title}</div>
      <p>{copy.description}</p>
    </div>
  );
}

function emptyStateCopy(path: TracePath): { title: string; description: string } {
  if (path === "context") {
    return {
      title: "No context events.",
      description: "No selected or excluded context was recorded."
    };
  }

  if (path === "action") {
    return {
      title: "No action events.",
      description: "No tool inventory or tool call was recorded."
    };
  }

  if (path === "model") {
    return {
      title: "No model event captured.",
      description: "No model provider event was recorded for this run."
    };
  }

  return {
    title: "No system events.",
    description: "No lifecycle events were recorded."
  };
}

function actionSummary(
  toolName: string,
  result: Extract<TraceEvent, { type: "tool.completed" }> | undefined
): string {
  if (!result) {
    return "Call started. No result recorded yet.";
  }

  return result.payload.status === "success" ? "Tool completed successfully." : result.payload.errorMessage ?? "Tool returned an error.";
}

function modelSummary(payload: Extract<TraceEvent, { type: "model.completed" }>["payload"]): string {
  const tokens = [
    payload.inputTokens === undefined ? undefined : `${String(payload.inputTokens)} input tokens`,
    payload.outputTokens === undefined ? undefined : `${String(payload.outputTokens)} output tokens`
  ].filter((item): item is string => Boolean(item));

  return [
    `Completed in ${formatDuration(payload.latencyMs)}`,
    ...tokens,
    payload.estimatedCostUsd === undefined ? undefined : `$${payload.estimatedCostUsd.toFixed(6)} estimated`
  ]
    .filter(Boolean)
    .join(" · ");
}

function EventDetail({ event }: { event: TraceEvent }) {
  switch (event.type) {
    case "context.selected":
    case "context.excluded":
      return (
        <div className="event-detail">
          <KeyValueList
            items={[
              ["Source", humanizeKey(event.payload.sourceType)],
              ["Access rule", event.payload.permissionRule ?? "Not recorded"],
              ["Reason", event.payload.reason],
              ...provenanceItems(event.payload)
            ]}
          />
        </div>
      );
    case "tool.listed":
      return (
        <div className="event-detail">
          <KeyValueList
            items={[
              ["Tools reported", String(event.payload.toolCount ?? event.payload.tools.length)],
              ["Inventory hash", event.payload.inventoryHash ?? "Not recorded"],
              ...provenanceItems(event.payload)
            ]}
          />
        </div>
      );
    case "tool.called":
      return (
        <div className="event-detail">
          <KeyValueList items={provenanceItems(event.payload)} />
          <div className="event-subheading">Arguments sent</div>
          <ToolArgumentsView toolName={event.payload.toolName} value={event.payload.arguments} />
        </div>
      );
    case "tool.completed": {
      const toolStatus = toolCompletedStatus(event.payload);
      return (
        <div className="event-detail">
          <KeyValueList
            items={[
              ["Status", toolStatus],
              ["Latency", formatDuration(event.payload.latencyMs)],
              ...provenanceItems(event.payload)
            ]}
          />
          {toolErrorMessage(event.payload) ? <p className="event-error">{toolErrorMessage(event.payload)}</p> : null}
          {event.payload.result === undefined ? null : (
            <>
              <div className="event-subheading">Result returned</div>
              <ToolResultView toolName={event.payload.toolName} value={event.payload.result} />
            </>
          )}
        </div>
      );
    }
    case "tool.blocked":
      return (
        <div className="event-detail">
          <KeyValueList items={[["Reason", event.payload.reason], ...provenanceItems(event.payload)]} />
        </div>
      );
    case "authorization.decided":
      return (
        <div className="event-detail">
          <KeyValueList
            items={[
              ["Decision", event.payload.decision],
              ["Principal", event.payload.principalId],
              ["Purpose", event.payload.purpose],
              ["Policy", event.payload.policyId],
              ["Reason", event.payload.reason],
              ...provenanceItems(event.payload)
            ]}
          />
        </div>
      );
    case "model.called":
      return <p className="event-detail">{event.payload.routeReason ?? event.payload.taskType}</p>;
    case "model.completed":
      return (
        <div className="event-detail">
          <KeyValueList
            items={[
              ["Status", event.payload.status],
              ["Latency", formatDuration(event.payload.latencyMs)],
              ...(event.payload.inputTokens === undefined
                ? []
                : ([["Input tokens", String(event.payload.inputTokens)]] as [string, string][])),
              ...(event.payload.outputTokens === undefined
                ? []
                : ([["Output tokens", String(event.payload.outputTokens)]] as [string, string][])),
              ...(event.payload.estimatedCostUsd === undefined
                ? []
                : ([["Estimated cost", `$${event.payload.estimatedCostUsd.toFixed(6)}`]] as [string, string][]))
            ]}
          />
          {event.payload.errorMessage ? <p className="event-error">{event.payload.errorMessage}</p> : null}
        </div>
      );
    case "run.started":
      return event.payload.scenario ? <p className="event-detail">{event.payload.scenario}</p> : null;
    case "run.completed":
      return event.payload.summary ? <p className="event-detail">{event.payload.summary}</p> : null;
  }
}

function toolCompletedStatus(payload: Extract<TraceEvent, { type: "tool.completed" }>["payload"]): "success" | "error" {
  if (toolResultIsError(payload.result)) {
    return "error";
  }

  return payload.status;
}

function toolErrorMessage(payload: Extract<TraceEvent, { type: "tool.completed" }>["payload"]): string | undefined {
  if (payload.errorMessage) {
    return payload.errorMessage;
  }

  if (!toolResultIsError(payload.result)) {
    return undefined;
  }

  return readMcpTextContent((payload.result as { content?: unknown }).content) ?? "The tool returned an error.";
}

function KeyValueList({ items }: { items: readonly [string, string][] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <dl className="key-value-list">
      {items.map(([key, value]) => (
        <div className="key-value-row" key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function provenanceItems(payload: {
  permissionSnapshotId?: string | undefined;
  contextDecisionId?: string | undefined;
  authorizationDecisionId?: string | undefined;
  authorizationRule?: string | undefined;
}): [string, string][] {
  return [
    ...(payload.permissionSnapshotId ? ([["Permission snapshot", payload.permissionSnapshotId]] as [string, string][]) : []),
    ...(payload.contextDecisionId ? ([["Context decision", payload.contextDecisionId]] as [string, string][]) : []),
    ...(payload.authorizationDecisionId
      ? ([["Authorization decision", payload.authorizationDecisionId]] as [string, string][])
      : []),
    ...(payload.authorizationRule ? ([["Authorization rule", payload.authorizationRule]] as [string, string][]) : [])
  ];
}

function ToolArgumentsView({ toolName, value }: { toolName: string; value: unknown }) {
  const issueInput = toolName === "github__create_issue" ? readGithubIssueInput(value) : undefined;

  if (!issueInput) {
    return <PayloadView value={value} />;
  }

  return (
    <div className="issue-summary">
      <KeyValueList
        items={[
          ["Repository", `${issueInput.owner}/${issueInput.repo}`],
          ["Title", issueInput.title]
        ]}
      />
      <div className="issue-body-preview">
        <div className="event-subheading">Body</div>
        <pre>{issueInput.body}</pre>
      </div>
      {issueInput.labels.length > 0 ? (
        <div className="inline-tags">
          {issueInput.labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ToolResultView({ toolName, value }: { toolName: string; value: unknown }) {
  const issue = toolName === "github__create_issue" ? readGithubIssueResult(value) : undefined;

  if (!issue) {
    return <PayloadView value={value} />;
  }

  return (
    <div className="issue-result">
      <div className="issue-result-title">Created GitHub issue</div>
      <KeyValueList
        items={[
          ["Issue", `#${String(issue.number)} ${issue.title}`],
          ["URL", issue.url]
        ]}
      />
      <details className="provider-result">
        <summary>Show provider result</summary>
        <PayloadView value={value} />
      </details>
    </div>
  );
}

function PayloadView({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") {
    return <p>{String(value)}</p>;
  }

  if (Array.isArray(value)) {
    const items = value as readonly unknown[];

    return (
      <ul className="payload-list">
        {items.map((item, index) => (
          <li key={index}>
            <PayloadValue value={item} />
          </li>
        ))}
      </ul>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(([key]) => {
    if (key === "isError") {
      return false;
    }

    if (key === "content" && toolResultIsError(value)) {
      return false;
    }

    return true;
  });

  if (entries.length === 0) {
    return <p>No arguments.</p>;
  }

  return (
    <dl className="payload-view">
      {entries.map(([key, entryValue]) => (
        <div className="payload-row" key={key}>
          <dt>{humanizeKey(key)}</dt>
          <dd>
            <PayloadValue value={entryValue} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PayloadValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted">None</span>;
  }

  if (typeof value === "string") {
    if (value.includes("\n")) {
      return <pre className="payload-text">{value}</pre>;
    }

    if (value.startsWith("http://") || value.startsWith("https://")) {
      return (
        <a className="inline-link" href={value}>
          {value}
        </a>
      );
    }

    return <span>{value}</span>;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return <span>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted">None</span>;
    }

    if (value.every(isMcpTextContent)) {
      return (
        <div className="payload-stack">
          {value.map((item, index) => (
            <pre className="payload-text" key={index}>
              {item.text}
            </pre>
          ))}
        </div>
      );
    }

    return (
      <div className="inline-tags">
        {value.map((item, index) => (
          <span key={index}>{typeof item === "object" ? JSON.stringify(item) : String(item)}</span>
        ))}
      </div>
    );
  }

  return <pre className="payload-text">{JSON.stringify(value, null, 2)}</pre>;
}

type GithubIssueInput = {
  owner: string;
  repo: string;
  title: string;
  body: string;
  labels: string[];
};

type GithubIssueResult = {
  number: number;
  title: string;
  url: string;
};

function readGithubIssueInput(value: unknown): GithubIssueInput | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const input = (value as { input?: unknown }).input;

  if (!input || typeof input !== "object") {
    return undefined;
  }

  const candidate = input as {
    owner?: unknown;
    repo?: unknown;
    title?: unknown;
    body?: unknown;
    labels?: unknown;
  };

  if (
    typeof candidate.owner !== "string" ||
    typeof candidate.repo !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.body !== "string"
  ) {
    return undefined;
  }

  return {
    owner: candidate.owner,
    repo: candidate.repo,
    title: candidate.title,
    body: candidate.body,
    labels: Array.isArray(candidate.labels)
      ? candidate.labels.filter((label): label is string => typeof label === "string")
      : []
  };
}

function readGithubIssueResult(value: unknown): GithubIssueResult | undefined {
  const text = readMcpTextContent(readResultContent(value));

  if (!text) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(text);

    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }

    const candidate = parsed as {
      number?: unknown;
      title?: unknown;
      html_url?: unknown;
      url?: unknown;
    };
    const url = candidate.html_url ?? candidate.url;

    if (
      typeof candidate.number !== "number" ||
      typeof candidate.title !== "string" ||
      typeof url !== "string"
    ) {
      return undefined;
    }

    return {
      number: candidate.number,
      title: candidate.title,
      url
    };
  } catch {
    return undefined;
  }
}

function readResultContent(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return (value as { content?: unknown }).content;
}

function toolResultIsError(result: unknown): boolean {
  return Boolean(result && typeof result === "object" && (result as { isError?: unknown }).isError === true);
}

function readMcpTextContent(content: unknown): string | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }

  const text = content
    .filter(isMcpTextContent)
    .map((item) => item.text)
    .join("\n")
    .trim();

  return text || undefined;
}

function isMcpTextContent(value: unknown): value is { type: "text"; text: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { type?: unknown }).type === "text" &&
      typeof (value as { text?: unknown }).text === "string"
  );
}
