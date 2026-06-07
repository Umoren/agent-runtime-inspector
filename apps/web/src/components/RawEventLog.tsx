import type { TraceEvent } from "@ari/core";
import { Card, CardContent, CardDescription, CardTitle } from "./ui/card";

export function RawEventLog({ events }: { events: readonly TraceEvent[] }) {
  return (
    <Card className="section">
      <details className="raw-log">
        <summary className="disclosure-summary">
          <div>
            <CardTitle>Raw event log</CardTitle>
            <CardDescription>The raw event stream is available for replay and audit export.</CardDescription>
          </div>
          <span className="disclosure-action disclosure-action-open">Hide raw JSON</span>
          <span className="disclosure-action disclosure-action-closed">Show raw JSON</span>
        </summary>
        <CardContent>
          <div className="code">
            <pre>{JSON.stringify(events, null, 2)}</pre>
          </div>
        </CardContent>
      </details>
    </Card>
  );
}
