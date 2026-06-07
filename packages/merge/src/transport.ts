export type AgentHandlerTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

export type AgentHandlerTransport = {
  listTools(): Promise<AgentHandlerTool[]>;
  callTool(input: {
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<unknown>;
  close?(): Promise<void>;
};
