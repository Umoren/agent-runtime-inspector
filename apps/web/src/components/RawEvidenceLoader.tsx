"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";

export function RawEvidenceLoader({ runId }: { runId: string }) {
  const [rawEvents, setRawEvents] = useState<unknown>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function loadRawEvents() {
    if (loading || rawEvents !== undefined) return;

    setLoading(true);
    setError(undefined);

    try {
      const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/events`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Raw evidence request failed with ${String(response.status)}.`);
      }

      setRawEvents(await response.json() as unknown);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Raw evidence could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  if (rawEvents !== undefined) {
    return <div className="raw-evidence"><pre>{JSON.stringify(rawEvents, null, 2)}</pre></div>;
  }

  return (
    <div className="raw-evidence-loader">
      <button type="button" onClick={() => void loadRawEvents()} disabled={loading}>
        {loading ? <LoaderCircle className="raw-loader-icon" aria-hidden="true" size={16} /> : <Download aria-hidden="true" size={16} />}
        {loading ? "Loading raw evidence" : "Load raw JSON"}
      </button>
      <p>Raw events are fetched separately and may contain sensitive tool input or output.</p>
      {error ? <div className="raw-evidence-error">{error}</div> : null}
    </div>
  );
}
