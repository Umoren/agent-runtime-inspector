import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { mergeAgentHandlerConfigSchema } from "@ari/merge";
import { readProxyEnv } from "./env.js";
import { createAriMcpProxyServer } from "./server.js";
import { createLocalContextProviderFromFile } from "./context-provider.js";

export async function runProxyServer(): Promise<void> {
  const env = readProxyEnv();
  const merge = mergeAgentHandlerConfigSchema.parse({
    mcpUrl: env.MERGE_AGENT_HANDLER_MCP_URL,
    registeredUserId: env.MERGE_REGISTERED_USER_ID,
    toolPackId: env.MERGE_TOOL_PACK_ID,
    apiKey: env.MERGE_API_KEY
  });

  const server = await createAriMcpProxyServer({
    collectorUrl: env.ARI_COLLECTOR_URL,
    merge,
    ...(env.ARI_CONTEXT_REGISTRY_PATH
      ? { contextProvider: createLocalContextProviderFromFile(env.ARI_CONTEXT_REGISTRY_PATH) }
      : {})
  });

  process.on("SIGINT", () => {
    void server.close();
    process.exit(0);
  });

  console.error("ARI MCP proxy connected to Merge Agent Handler.");
  await server.connect(new StdioServerTransport());
}
