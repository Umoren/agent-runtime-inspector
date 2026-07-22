import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PersistentOAuthProvider } from "./oauth-provider.js";

function createProvider(tokenPath: string): PersistentOAuthProvider {
  return new PersistentOAuthProvider({
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUrl: "http://127.0.0.1:4545/oauth/callback",
    tokenPath,
    scope: "gmail.readonly gmail.compose"
  });
}

describe("PersistentOAuthProvider", () => {
  it("persists and reloads OAuth tokens", () => {
    const directory = mkdtempSync(join(tmpdir(), "ari-oauth-"));
    const tokenPath = join(directory, "nested", "tokens.json");
    const provider = createProvider(tokenPath);
    const tokens = {
      access_token: "access-token",
      refresh_token: "refresh-token",
      token_type: "Bearer",
      expires_in: 3600
    };

    provider.saveTokens(tokens);

    expect(provider.tokens()).toEqual(tokens);
    expect(JSON.parse(readFileSync(tokenPath, "utf8"))).toEqual(tokens);
  });

  it("treats malformed token storage as unauthenticated", () => {
    const directory = mkdtempSync(join(tmpdir(), "ari-oauth-"));
    const tokenPath = join(directory, "tokens.json");
    writeFileSync(tokenPath, "not-json", "utf8");

    expect(createProvider(tokenPath).tokens()).toBeUndefined();
  });

  it("removes persisted credentials when tokens are invalidated", () => {
    const directory = mkdtempSync(join(tmpdir(), "ari-oauth-"));
    const tokenPath = join(directory, "tokens.json");
    const provider = createProvider(tokenPath);
    provider.saveTokens({ access_token: "access-token", token_type: "Bearer" });

    provider.invalidateCredentials("tokens");

    expect(provider.tokens()).toBeUndefined();
  });
});
