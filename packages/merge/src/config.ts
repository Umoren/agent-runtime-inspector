import { z } from "zod";

export const mergeAgentHandlerConfigSchema = z.object({
  mcpUrl: z.string().url(),
  registeredUserId: z.string().min(1),
  toolPackId: z.string().min(1),
  apiKey: z.string().min(1).optional()
});

export type MergeAgentHandlerConfig = z.infer<typeof mergeAgentHandlerConfigSchema>;

export function mergeHeaders(config: MergeAgentHandlerConfig): Record<string, string> {
  return {
    ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
    "x-ari-registered-user-id": config.registeredUserId,
    "x-ari-tool-pack-id": config.toolPackId
  };
}
