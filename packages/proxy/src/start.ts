import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { mergeAgentHandlerConfigSchema } from "@ari/merge";
import { readProxyEnv } from "./env.js";
import { createAriMcpProxyServer } from "./server.js";
import {
  createContextProviderFromConfigFile,
  createLocalContextProviderFromFile,
  type ContextProvider
} from "./context-provider.js";
import type { ProxyEnv } from "./env.js";

export async function runProxyServer(): Promise<void> {
  const env = readProxyEnv();
  const merge = mergeAgentHandlerConfigSchema.parse({
    mcpUrl: env.MERGE_AGENT_HANDLER_MCP_URL,
    registeredUserId: env.MERGE_REGISTERED_USER_ID,
    toolPackId: env.MERGE_TOOL_PACK_ID,
    apiKey: env.MERGE_API_KEY
  });

  const contextProvider = contextProviderFromEnv(env);
  const server = await createAriMcpProxyServer({
    collectorUrl: env.ARI_COLLECTOR_URL,
    merge,
    ...(contextProvider ? { contextProvider } : {})
  });

  process.on("SIGINT", () => {
    void server.close();
    process.exit(0);
  });

  console.error("ARI MCP proxy connected to Merge Agent Handler.");
  await server.connect(new StdioServerTransport());
}

function contextProviderFromEnv(env: ProxyEnv): ContextProvider | undefined {
  if (env.ARI_CONTEXT_PROVIDER_CONFIG_PATH && env.ARI_CONTEXT_REGISTRY_PATH) {
    throw new Error("Set either ARI_CONTEXT_PROVIDER_CONFIG_PATH or ARI_CONTEXT_REGISTRY_PATH, not both.");
  }

  if (env.ARI_CONTEXT_PROVIDER_CONFIG_PATH) {
    return createContextProviderFromConfigFile(env.ARI_CONTEXT_PROVIDER_CONFIG_PATH);
  }

  if (env.ARI_CONTEXT_REGISTRY_PATH) {
    return createLocalContextProviderFromFile(env.ARI_CONTEXT_REGISTRY_PATH);
  }

  return undefined;
}
