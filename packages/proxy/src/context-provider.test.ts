import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createFileContextProvider,
  createScopePermissionEvaluator,
  type ContextRequest,
  type FileContextProviderConfig
} from "./context-provider.js";

const tempDirectories: string[] = [];

describe("file-backed context provider", () => {
  afterEach(() => {
    for (const directory of tempDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("turns allowed files into selected context and withholds default-denied files", async () => {
    const root = createTempDirectory();
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "context.md"), "ARI context provider notes.");
    writeFileSync(join(root, ".env"), "ARI_MODEL_API_KEY=secret");

    const evaluated = await evaluateContext(fileProviderConfig(root, { include: ["**/*"] }));

    expect(evaluated.selected).toEqual([
      expect.objectContaining({
        sourceId: "file:ari_repo_file:docs/context.md",
        content: "ARI context provider notes."
      })
    ]);
    expect(evaluated.excluded).toEqual([
      expect.objectContaining({
        sourceId: "file:ari_repo_file:.env",
        reason: "File matches ARI's default secret or runtime-file exclusion rules.",
        permissionRule: "default exclude .env"
      })
    ]);
  });

  it("rejects symlinks that resolve outside the configured context root", async () => {
    const root = createTempDirectory();
    const outside = createTempDirectory();
    writeFileSync(join(outside, "private.md"), "outside-root secret");
    symlinkSync(join(outside, "private.md"), join(root, "private.md"));

    const evaluated = await evaluateContext(fileProviderConfig(root, { include: ["**/*.md"] }));

    expect(evaluated.selected).toHaveLength(0);
    expect(evaluated.excluded).toEqual([
      expect.objectContaining({
        sourceId: "file:ari_repo_file:private.md",
        reason: "Path is a symbolic link that resolves outside the configured context root.",
        permissionRule: "realpath must stay under context root"
      })
    ]);
  });

  it("excludes oversized and binary files without returning their contents", async () => {
    const root = createTempDirectory();
    writeFileSync(join(root, "large.md"), "x".repeat(20));
    writeFileSync(join(root, "image.bin"), Buffer.from([0, 1, 2, 3]));

    const evaluated = await evaluateContext(
      fileProviderConfig(root, {
        include: ["**/*"],
        defaultMaxBytes: 10
      })
    );

    expect(evaluated.selected).toHaveLength(0);
    expect(evaluated.excluded).toEqual([
      expect.objectContaining({
        sourceId: "file:ari_repo_file:image.bin",
        reason: "File appears to be binary content and is not safe to return as text context.",
        permissionRule: "content must be UTF-8 text"
      }),
      expect.objectContaining({
        sourceId: "file:ari_repo_file:large.md",
        reason: "File exceeds the configured context size limit of 10 byte(s).",
        permissionRule: "size <= 10"
      })
    ]);
  });

  it("rejects include patterns that try to escape the configured root", () => {
    const root = createTempDirectory();

    expect(() =>
      createFileContextProvider(
        fileProviderConfig(root, {
          include: ["../private.md"]
        })
      )
    ).toThrow("Context file pattern must stay inside the configured root");
  });
});

function createTempDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "ari-file-context-"));
  tempDirectories.push(directory);
  return directory;
}

async function evaluateContext(config: FileContextProviderConfig) {
  const provider = createFileContextProvider(config);
  const request: ContextRequest = {
    task: "Create an audit summary from ARI repository context.",
    requesterId: "samuel",
    purpose: "ari_context_audit"
  };
  const requester = await provider.getRequesterSnapshot(request.requesterId);

  if (!requester) {
    throw new Error("Expected requester snapshot.");
  }

  return createScopePermissionEvaluator().evaluate({
    request,
    requester,
    sources: await provider.getCandidateSources(request),
    provenance: {
      permissionSnapshotId: "perm_test",
      contextDecisionId: "ctx_test",
      authorizationDecisionId: "auth_test",
      authorizationRule: "test_file_context_rule"
    }
  });
}

function fileProviderConfig(
  root: string,
  overrides: {
    include: string[];
    defaultMaxBytes?: number;
  }
): FileContextProviderConfig {
  return {
    kind: "file",
    root,
    requesters: [
      {
        requesterId: "samuel",
        scopes: ["ari_repo_reader"]
      }
    ],
    sources: [
      {
        sourceType: "ari_repo_file",
        include: overrides.include,
        exclude: [],
        requiredScopes: ["ari_repo_reader"],
        allowedPurposes: ["ari_context_audit"],
        classification: "internal"
      }
    ],
    ...(overrides.defaultMaxBytes ? { defaultMaxBytes: overrides.defaultMaxBytes } : {})
  };
}
