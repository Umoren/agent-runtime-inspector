import { createMcpSdkTransport, type MergeAgentHandlerConfig } from "@ari/merge";
import { createInstrumentedActionProvider, type ActionProvider } from "./action-provider.js";

export async function createMergeActionProvider(config: MergeAgentHandlerConfig): Promise<ActionProvider> {
  const transport = await createMcpSdkTransport(config);

  return createInstrumentedActionProvider(
    {
      upstreamId: config.toolPackId,
      upstreamType: "merge-agent-handler",
      eventSource: "merge",
      legacy: {
        toolPackId: config.toolPackId,
        registeredUserId: config.registeredUserId
      }
    },
    transport
  );
}
