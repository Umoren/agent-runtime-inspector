import type { TraceEvent, TracePath } from "@ari/core";
import { formatDateTime, formatDuration, humanizeKey } from "../lib/format";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

const pathCopy: Record<TracePath, string> = {
  context: "Sources selected or excluded before the LLM response",
  action: "Tools exposed, calls made, arguments sent, and results returned",
  model: "Provider/model selection, latency, token use, cost, and status",
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
            <EventList path={path} events={events} />
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
        <EventList path={path} events={events} />
      </CardContent>
    </Card>
  );
}

function EventList({ path, events }: { path: TracePath; events: readonly TraceEvent[] }) {
  if (events.length === 0) {
    return <EmptyPathState path={path} />;
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

function pathLabel(path: TracePath): string {
  if (path === "context") return "Context path";
  if (path === "action") return "Action path";
  if (path === "model") return "Model path";
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
      title: "No context events recorded.",
      description:
        "Context events appear when the run selects or excludes source data before the LLM response."
    };
  }

  if (path === "action") {
    return {
      title: "No action events recorded.",
      description:
        "Action events appear when the agent lists tools, calls a tool, receives a result, or gets blocked by policy."
    };
  }

  if (path === "model") {
    return {
      title: "No model events recorded.",
      description:
        "Model events appear when the run records provider/model selection, latency, token use, cost, or fallback status."
    };
  }

  return {
    title: "No system events recorded.",
    description: "System events show when the run started, completed, failed, or changed lifecycle state."
  };
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
              ["Reason", event.payload.reason]
            ]}
          />
        </div>
      );
    case "tool.listed":
      return (
        <div className="event-detail">
          <KeyValueList
            items={[
              ["Tools available", String(event.payload.tools.length)]
            ]}
          />
        </div>
      );
    case "tool.called":
      return (
        <div className="event-detail">
          <div className="event-subheading">Arguments sent</div>
          <ToolArgumentsView toolName={event.payload.toolName} value={event.payload.arguments} />
        </div>
      );
    case "tool.completed":
      const toolStatus = toolCompletedStatus(event.payload);
      return (
        <div className="event-detail">
          <KeyValueList
            items={[
              ["Status", toolStatus],
              ["Latency", formatDuration(event.payload.latencyMs)]
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
    case "tool.blocked":
      return <p className="event-detail">{event.payload.reason}</p>;
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
    return (
      <ul className="payload-list">
        {value.map((item, index) => (
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
