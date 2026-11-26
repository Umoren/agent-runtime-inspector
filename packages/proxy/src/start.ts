import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readProxyEnv } from "./env.js";
import { createAriMcpProxyServer } from "./server.js";
import { createHttpMcpActionProvider, type ActionProvider } from "./action-provider.js";
import { createDenyAllPolicyEngine, createOpaHttpPolicyEngine, type PolicyEngine } from "./policy.js";
import {
  createContextProviderFromConfigFile,
  createLocalContextProviderFromFile,
  type ContextProvider
} from "./context-provider.js";
import type { ProxyEnv } from "./env.js";

export async function runProxyServer(): Promise<void> {
  const env = readProxyEnv();
  const actionProvider = await actionProviderFromEnv(env);
  const contextProvider = contextProviderFromEnv(env);
  const server = createAriMcpProxyServer({
    collectorUrl: env.ARI_COLLECTOR_URL,
    actionProvider,
    identity: {
      principalId: env.ARI_PRINCIPAL_ID,
      purpose: env.ARI_PURPOSE
    },
    policyEngine: policyEngineFromEnv(env),
    allowAgentDeclaredContext: env.ARI_ALLOW_AGENT_DECLARED_CONTEXT === "true",
    ...(contextProvider ? { contextProvider } : {})
  });

  process.on("SIGINT", () => {
    void server.close();
    process.exit(0);
  });

  console.error(`ARI MCP gateway connected to ${actionProvider.metadata.upstreamId}.`);
  await server.connect(new StdioServerTransport());
}

async function actionProviderFromEnv(env: ProxyEnv): Promise<ActionProvider> {
  if (env.ARI_UPSTREAM_MCP_URL) {
    if (!env.ARI_UPSTREAM_ID || !env.ARI_UPSTREAM_TYPE) {
      throw new Error("ARI_UPSTREAM_ID and ARI_UPSTREAM_TYPE are required with ARI_UPSTREAM_MCP_URL.");
    }

    return await createHttpMcpActionProvider({
      url: env.ARI_UPSTREAM_MCP_URL,
      upstreamId: env.ARI_UPSTREAM_ID,
      upstreamType: env.ARI_UPSTREAM_TYPE,
      ...(env.ARI_UPSTREAM_HEADERS_JSON ? { headers: parseHeaders(env.ARI_UPSTREAM_HEADERS_JSON, "ARI_UPSTREAM_HEADERS_JSON") } : {}),
      ...oauthConfigFromEnv(env)
    });
  }

  throw new Error("Configure ARI_UPSTREAM_MCP_URL, ARI_UPSTREAM_ID, and ARI_UPSTREAM_TYPE.");
}

function oauthConfigFromEnv(env: ProxyEnv): { oauth?: {
  clientId: string;
  clientSecret: string;
  redirectUrl: string;
  tokenPath: string;
  scope?: string;
} } {
  const values = [
    env.ARI_UPSTREAM_OAUTH_CLIENT_ID,
    env.ARI_UPSTREAM_OAUTH_CLIENT_SECRET,
    env.ARI_UPSTREAM_OAUTH_REDIRECT_URL,
    env.ARI_UPSTREAM_OAUTH_TOKEN_PATH
  ];

  if (!values.some(Boolean)) return {};
  if (!values.every(Boolean)) {
    throw new Error("OAuth configuration requires client ID, client secret, redirect URL, and token path together.");
  }

  return {
    oauth: {
      clientId: env.ARI_UPSTREAM_OAUTH_CLIENT_ID as string,
      clientSecret: env.ARI_UPSTREAM_OAUTH_CLIENT_SECRET as string,
      redirectUrl: env.ARI_UPSTREAM_OAUTH_REDIRECT_URL as string,
      tokenPath: env.ARI_UPSTREAM_OAUTH_TOKEN_PATH as string,
      ...(env.ARI_UPSTREAM_OAUTH_SCOPE ? { scope: env.ARI_UPSTREAM_OAUTH_SCOPE } : {})
    }
  };
}

function policyEngineFromEnv(env: ProxyEnv): PolicyEngine {
  if (!env.ARI_POLICY_DECISION_URL) {
    return createDenyAllPolicyEngine();
  }

  return createOpaHttpPolicyEngine({
    decisionUrl: env.ARI_POLICY_DECISION_URL,
    ...(env.ARI_POLICY_HEADERS_JSON ? { headers: parseHeaders(env.ARI_POLICY_HEADERS_JSON, "ARI_POLICY_HEADERS_JSON") } : {})
  });
}

function parseHeaders(value: string, variableName: string): Record<string, string> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value) as unknown;
  } catch (error) {
    throw new Error(`${variableName} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  return z.record(z.string().min(1)).parse(parsed);
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
