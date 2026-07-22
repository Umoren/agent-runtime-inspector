import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { auth, UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { Result, ToolCallProvenance, TraceEvent, TraceSource } from "@ari/core";
import { err, ok } from "@ari/core";
import { createServer } from "node:http";
import { PersistentOAuthProvider, type PersistentOAuthProviderConfig } from "./oauth-provider.js";

export type ActionTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

export type ActionTransport = {
  listTools(): Promise<ActionTool[]>;
  callTool(input: { name: string; arguments: Record<string, unknown> }): Promise<unknown>;
  close?(): Promise<void>;
};

export type ActionProviderMetadata = {
  upstreamId: string;
  upstreamType: string;
  eventSource: TraceSource;
  legacy?: {
    toolPackId?: string;
    registeredUserId?: string;
  };
};

export type ActionProviderError = {
  code: "tool-list-failed" | "tool-call-failed";
  message: string;
};

export type ActionProvider = {
  metadata: ActionProviderMetadata;
  listTools(
    runId: string,
    provenance?: ToolCallProvenance
  ): Promise<Result<{ tools: ActionTool[]; event: TraceEvent }, ActionProviderError>>;
  callTool(input: {
    runId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    correlationId?: string;
    provenance?: ToolCallProvenance;
  }): Promise<
    Result<
      {
        started: TraceEvent;
        completed: TraceEvent;
        result?: unknown;
        status: "success" | "error";
        errorMessage?: string;
      },
      ActionProviderError
    >
  >;
  close(): Promise<void>;
};

export type HttpMcpActionProviderConfig = {
  upstreamId: string;
  upstreamType: string;
  url: string;
  headers?: Record<string, string>;
  oauth?: PersistentOAuthProviderConfig;
};

export async function createHttpMcpActionProvider(config: HttpMcpActionProviderConfig): Promise<ActionProvider> {
  const client = new Client({ name: "agent-runtime-inspector", version: "0.0.0" });
  const oauthProvider = config.oauth ? new PersistentOAuthProvider(config.oauth) : undefined;
  const transport = new StreamableHTTPClientTransport(new URL(config.url), {
    ...(oauthProvider ? { authProvider: oauthProvider } : {}),
    requestInit: {
      ...(config.headers ? { headers: config.headers } : {})
    }
  });

  await connectHttpTransport(client, transport, oauthProvider);
  await authorizeConfiguredUpstream(config.url, transport, oauthProvider);
  // Some upstreams request OAuth only on the first tool request.
  await withOAuthAuthorization(() => client.listTools(), transport, oauthProvider);

  return createInstrumentedActionProvider(
    {
      upstreamId: config.upstreamId,
      upstreamType: config.upstreamType,
      eventSource: "mcp"
    },
    {
      async listTools() {
        const result = await withOAuthAuthorization(() => client.listTools(), transport, oauthProvider);
        return result.tools.map((tool) => ({
          name: tool.name,
          ...(tool.description ? { description: tool.description } : {}),
          inputSchema: tool.inputSchema
        }));
      },
      async callTool(input) {
        return await withOAuthAuthorization(
          () => client.callTool({
            name: input.name,
            arguments: input.arguments
          }),
          transport,
          oauthProvider
        );
      },
      async close() {
        await client.close();
      }
    }
  );
}

async function connectHttpTransport(
  client: Client,
  transport: StreamableHTTPClientTransport,
  oauthProvider: PersistentOAuthProvider | undefined
): Promise<void> {
  try {
    await client.connect(transport as Transport);
  } catch (error) {
    if (!(error instanceof UnauthorizedError) || !oauthProvider) throw error;

    const authorizationCode = await waitForAuthorizationCode(oauthProvider.redirectUrl, oauthProvider.expectedState());
    await transport.finishAuth(authorizationCode);
    await client.connect(transport as Transport);
  }
}

async function withOAuthAuthorization<T>(
  operation: () => Promise<T>,
  transport: StreamableHTTPClientTransport,
  oauthProvider: PersistentOAuthProvider | undefined
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof UnauthorizedError) || !oauthProvider) throw error;

    const authorizationCode = await waitForAuthorizationCode(oauthProvider.redirectUrl, oauthProvider.expectedState());
    await transport.finishAuth(authorizationCode);
    return await operation();
  }
}

async function authorizeConfiguredUpstream(
  upstreamUrl: string,
  transport: StreamableHTTPClientTransport,
  oauthProvider: PersistentOAuthProvider | undefined
): Promise<void> {
  if (!oauthProvider) return;

  const result = await auth(oauthProvider, { serverUrl: new URL(upstreamUrl) });

  if (result === "AUTHORIZED") return;

  const authorizationCode = await waitForAuthorizationCode(oauthProvider.redirectUrl, oauthProvider.expectedState());
  await transport.finishAuth(authorizationCode);
}

function waitForAuthorizationCode(redirectUrl: string, expectedState: string): Promise<string> {
  const callbackUrl = new URL(redirectUrl);

  if (callbackUrl.protocol !== "http:" || (callbackUrl.hostname !== "127.0.0.1" && callbackUrl.hostname !== "localhost")) {
    return Promise.reject(new Error("ARI OAuth redirect URL must use http://127.0.0.1 or http://localhost."));
  }

  if (!callbackUrl.port) {
    return Promise.reject(new Error("ARI OAuth redirect URL must include an explicit local port."));
  }

  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const received = new URL(request.url ?? "/", callbackUrl);
      if (received.pathname !== callbackUrl.pathname) {
        response.writeHead(404).end();
        return;
      }

      const error = received.searchParams.get("error");
      const code = received.searchParams.get("code");
      const state = received.searchParams.get("state");

      if (error) {
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        response.end("ARI upstream authorization failed. You can close this window.", () => {
          server.close();
          reject(new Error(`OAuth authorization failed: ${error}`));
        });
        return;
      }

      if (!code || state !== expectedState) {
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        response.end("Invalid ARI OAuth callback. You can close this window.", () => {
          server.close();
          reject(new Error("OAuth callback did not contain a valid code and state."));
        });
        return;
      }

      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("ARI upstream authorization completed. You can close this window.", () => {
        server.close();
        resolve(code);
      });
    });

    server.on("error", (error) => {
      server.close();
      reject(error);
    });
    server.listen(Number(callbackUrl.port), callbackUrl.hostname);
  });
}

export function createInstrumentedActionProvider(
  metadata: ActionProviderMetadata,
  transport: ActionTransport
): ActionProvider {
  return {
    metadata,
    async listTools(runId, provenance) {
      try {
        const tools = await transport.listTools();
        return ok({
          tools,
          event: toolListedEvent(runId, metadata, tools, provenance)
        });
      } catch (error) {
        return err({ code: "tool-list-failed", message: errorMessage(error) });
      }
    },
    async callTool(input) {
      const startedAt = performance.now();
      const correlationId = input.correlationId ?? crypto.randomUUID();
      const started = toolCalledEvent(input, metadata, correlationId);

      try {
        const result = await transport.callTool({ name: input.toolName, arguments: input.arguments });
        const toolError = toolResultErrorMessage(result);
        const completed = toolCompletedEvent({
          ...input,
          metadata,
          correlationId,
          status: toolError ? "error" : "success",
          latencyMs: elapsedMs(startedAt),
          result,
          ...(toolError ? { errorMessage: toolError } : {})
        });

        return ok({
          started,
          completed,
          result,
          status: toolError ? "error" : "success",
          ...(toolError ? { errorMessage: toolError } : {})
        });
      } catch (error) {
        const message = errorMessage(error);
        return ok({
          started,
          completed: toolCompletedEvent({
            ...input,
            metadata,
            correlationId,
            status: "error",
            latencyMs: elapsedMs(startedAt),
            errorMessage: message
          }),
          status: "error",
          errorMessage: message
        });
      }
    },
    async close() {
      await transport.close?.();
    }
  };
}

function toolListedEvent(
  runId: string,
  metadata: ActionProviderMetadata,
  tools: readonly ActionTool[],
  provenance: ToolCallProvenance | undefined
): TraceEvent {
  return {
    id: crypto.randomUUID(),
    runId,
    type: "tool.listed",
    path: "action",
    source: metadata.eventSource,
    timestamp: new Date().toISOString(),
    payload: {
      ...provenancePayload(provenance),
      upstreamId: metadata.upstreamId,
      upstreamType: metadata.upstreamType,
      ...metadata.legacy,
      toolCount: tools.length,
      inventoryHash: toolInventoryHash(tools),
      tools: tools.map(({ name }) => ({ name })).sort((left, right) => left.name.localeCompare(right.name))
    }
  };
}

function toolCalledEvent(
  input: {
    runId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    provenance?: ToolCallProvenance;
  },
  metadata: ActionProviderMetadata,
  correlationId: string
): TraceEvent {
  return {
    id: crypto.randomUUID(),
    runId: input.runId,
    type: "tool.called",
    path: "action",
    source: metadata.eventSource,
    timestamp: new Date().toISOString(),
    payload: {
      ...provenancePayload(input.provenance),
      toolName: input.toolName,
      upstreamId: metadata.upstreamId,
      ...metadata.legacy,
      arguments: input.arguments,
      correlationId
    }
  };
}

function toolCompletedEvent(input: {
  runId: string;
  toolName: string;
  metadata: ActionProviderMetadata;
  status: "success" | "error";
  latencyMs: number;
  result?: unknown;
  errorMessage?: string;
  correlationId: string;
  provenance?: ToolCallProvenance;
}): TraceEvent {
  return {
    id: crypto.randomUUID(),
    runId: input.runId,
    type: "tool.completed",
    path: "action",
    source: input.metadata.eventSource,
    timestamp: new Date().toISOString(),
    payload: {
      ...provenancePayload(input.provenance),
      toolName: input.toolName,
      upstreamId: input.metadata.upstreamId,
      status: input.status,
      latencyMs: input.latencyMs,
      ...(input.result === undefined ? {} : { result: input.result }),
      ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
      correlationId: input.correlationId
    }
  };
}

function provenancePayload(provenance: ToolCallProvenance | undefined): Partial<TraceEvent["payload"]> {
  if (!provenance) return {};

  return {
    permissionSnapshotId: provenance.permissionSnapshotId,
    contextDecisionId: provenance.contextDecisionId,
    ...(provenance.authorizationDecisionId ? { authorizationDecisionId: provenance.authorizationDecisionId } : {}),
    ...(provenance.authorizationRule ? { authorizationRule: provenance.authorizationRule } : {})
  };
}

function toolInventoryHash(tools: readonly ActionTool[]): string {
  const inventory = [...tools]
    .map((tool) => ({
      name: tool.name,
      ...(tool.description === undefined ? {} : { description: tool.description }),
      ...(tool.inputSchema === undefined ? {} : { inputSchema: canonicalize(tool.inputSchema) })
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return `sha256:${createHash("sha256").update(JSON.stringify(inventory)).digest("hex")}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)])
  );
}

function elapsedMs(startedAt: number): number {
  return Math.max(0, performance.now() - startedAt);
}

function toolResultErrorMessage(result: unknown): string | undefined {
  if (!result || typeof result !== "object" || !("isError" in result) || result.isError !== true) return undefined;
  if (!("content" in result) || !Array.isArray(result.content)) return "The upstream MCP tool returned an error.";

  const content: unknown[] = result.content;
  const text = content.find(isTextContent);
  return text?.text ?? "The upstream MCP tool returned an error.";
}

function isTextContent(value: unknown): value is { type: "text"; text: string } {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.type === "text" && typeof item.text === "string";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
