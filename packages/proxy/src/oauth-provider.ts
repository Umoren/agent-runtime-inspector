import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import {
  OAuthTokensSchema,
  type OAuthClientInformationMixed,
  type OAuthClientMetadata,
  type OAuthTokens
} from "@modelcontextprotocol/sdk/shared/auth.js";

export type PersistentOAuthProviderConfig = {
  clientId: string;
  clientSecret: string;
  redirectUrl: string;
  tokenPath: string;
  scope?: string;
};

export class PersistentOAuthProvider implements OAuthClientProvider {
  readonly clientMetadata: OAuthClientMetadata;
  readonly redirectUrl: string;
  private readonly client: OAuthClientInformationMixed;
  private readonly tokenPath: string;
  private readonly authorizationState = randomUUID();
  private verifier: string | undefined;

  constructor(config: PersistentOAuthProviderConfig) {
    this.redirectUrl = config.redirectUrl;
    this.tokenPath = config.tokenPath;
    this.clientMetadata = {
      client_name: "Agent Runtime Inspector",
      redirect_uris: [config.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_post",
      ...(config.scope ? { scope: config.scope } : {})
    };
    this.client = {
      client_id: config.clientId,
      client_secret: config.clientSecret
    };
  }

  state(): string {
    return this.authorizationState;
  }

  expectedState(): string {
    return this.authorizationState;
  }

  clientInformation(): OAuthClientInformationMixed {
    return this.client;
  }

  tokens(): OAuthTokens | undefined {
    if (!existsSync(this.tokenPath)) return undefined;
    try {
      const parsed = OAuthTokensSchema.safeParse(JSON.parse(readFileSync(this.tokenPath, "utf8")) as unknown);
      return parsed.success ? parsed.data : undefined;
    } catch {
      return undefined;
    }
  }

  saveTokens(tokens: OAuthTokens): void {
    mkdirSync(dirname(this.tokenPath), { recursive: true, mode: 0o700 });
    writeFileSync(this.tokenPath, `${JSON.stringify(tokens, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }

  redirectToAuthorization(authorizationUrl: URL): void {
    console.error(`ARI upstream authorization required. Open this URL:\n${authorizationUrl.toString()}`);
  }

  saveCodeVerifier(codeVerifier: string): void {
    this.verifier = codeVerifier;
  }

  codeVerifier(): string {
    if (!this.verifier) throw new Error("No OAuth PKCE code verifier is available.");
    return this.verifier;
  }

  invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery"): void {
    if (scope === "all" || scope === "tokens") {
      if (existsSync(this.tokenPath)) unlinkSync(this.tokenPath);
    }
    if (scope === "all" || scope === "verifier") {
      this.verifier = undefined;
    }
  }
}
