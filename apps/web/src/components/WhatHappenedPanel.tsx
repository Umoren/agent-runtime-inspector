import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

export function WhatHappenedPanel({ explanation }: { explanation: string }) {
  return (
    <Card className="section">
      <CardHeader>
        <CardTitle>What happened</CardTitle>
        <CardDescription>
          Start here before reading individual events or raw JSON.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="lead-copy">{explanation}</p>
      </CardContent>
    </Card>
  );
}
