import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { MergeAgentHandlerConfig } from "./config.js";
import { mergeHeaders } from "./config.js";
import type { AgentHandlerTool, AgentHandlerTransport } from "./transport.js";

export async function createMcpSdkTransport(config: MergeAgentHandlerConfig): Promise<AgentHandlerTransport> {
  const client = new Client({
    name: "agent-runtime-inspector",
    version: "0.0.0"
  });
  const transport = new StreamableHTTPClientTransport(new URL(config.mcpUrl), {
    requestInit: {
      headers: mergeHeaders(config)
    }
  });

  await client.connect(transport as Transport);

  return {
    async listTools() {
      const result = await client.listTools();
      return result.tools.map((tool) => ({
        name: tool.name,
        ...(tool.description ? { description: tool.description } : {}),
        inputSchema: tool.inputSchema
      })) satisfies AgentHandlerTool[];
    },
    async callTool(input) {
      return client.callTool({
        name: input.name,
        arguments: input.arguments
      });
    },
    async close() {
      await client.close();
    }
  };
}
