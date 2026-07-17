export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
): Promise<Response> {
  const { runId } = await params;
  const collectorUrl = process.env.ARI_COLLECTOR_URL ?? "http://localhost:4319";
  let response: Response;

  try {
    response = await fetch(`${collectorUrl}/runs/${encodeURIComponent(runId)}`, {
      cache: "no-store"
    });
  } catch {
    return Response.json(
      {
        code: "collector-unreachable",
        message: "ARI could not reach the local collector."
      },
      { status: 503 }
    );
  }

  if (!response.ok) {
    return Response.json(
      {
        code: "raw-evidence-unavailable",
        message: "ARI could not load raw evidence for this run."
      },
      { status: response.status }
    );
  }

  return new Response(response.body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json"
    }
  });
}
