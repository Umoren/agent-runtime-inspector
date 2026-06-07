import type { RunSummary } from "@ari/core";
import { formatDateTime } from "../lib/format";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function RunSummaryPanel({ summary }: { summary: RunSummary }) {
  return (
    <section className="grid grid-3 section">
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge className={summary.status === "error" ? "status-error" : "status-success"}>{summary.status}</Badge>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Completed</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{summary.completedAt ? formatDateTime(summary.completedAt) : "Still running"}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{summary.totalEvents}</p>
        </CardContent>
      </Card>
    </section>
  );
}
