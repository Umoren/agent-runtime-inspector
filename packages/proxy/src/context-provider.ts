import { lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";
import type { ToolCallProvenance } from "@ari/merge";

export type ContextRequest = {
  task: string;
  requesterId: string;
  purpose: string;
  title?: string | undefined;
};

export type RequesterSnapshot = {
  requesterId: string;
  scopes: readonly string[];
};

export type ContextSource = {
  sourceId: string;
  sourceType: string;
  title: string;
  content: string;
  requiredScopes: readonly string[];
  allowedPurposes?: readonly string[] | undefined;
  classification?: string | undefined;
  providerExclusionReason?: string | undefined;
  providerPermissionRule?: string | undefined;
};

export type SelectedContext = {
  sourceId: string;
  sourceType: string;
  title: string;
  content: string;
  reason: string;
  permissionRule: string;
};

export type ExcludedContext = {
  sourceId: string;
  sourceType: string;
  title: string;
  reason: string;
  permissionRule: string;
};

export type ContextProvider = {
  getRequesterSnapshot(requesterId: string): Promise<RequesterSnapshot | undefined>;
  getCandidateSources(request: ContextRequest): Promise<readonly ContextSource[]>;
};

export type PermissionEvaluator = {
  evaluate(input: {
    request: ContextRequest;
    requester: RequesterSnapshot;
    sources: readonly ContextSource[];
    provenance: ToolCallProvenance;
  }): EvaluatedContext;
};

export type EvaluatedContext = {
  provenance: ToolCallProvenance;
  selected: readonly SelectedContext[];
  excluded: readonly ExcludedContext[];
};

const requesterSnapshotSchema = z.object({
  requesterId: z.string().min(1),
  scopes: z.array(z.string().min(1)).default([])
});

const contextSourceSchema = z.object({
  sourceId: z.string().min(1),
  sourceType: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  requiredScopes: z.array(z.string().min(1)).default([]),
  allowedPurposes: z.array(z.string().min(1)).optional(),
  classification: z.string().min(1).optional()
});

const localContextRegistrySchema = z.object({
  requesters: z.array(requesterSnapshotSchema),
  sources: z.array(contextSourceSchema)
});

type LocalContextRegistry = z.infer<typeof localContextRegistrySchema>;

const fileSourceGroupSchema = z.object({
  sourceType: z.string().min(1),
  include: z.array(z.string().min(1)).min(1),
  exclude: z.array(z.string().min(1)).default([]),
  requiredScopes: z.array(z.string().min(1)).default([]),
  allowedPurposes: z.array(z.string().min(1)).optional(),
  classification: z.string().min(1).optional(),
  maxBytes: z.number().int().positive().optional()
});

const fileContextProviderConfigSchema = z.object({
  kind: z.literal("file"),
  root: z.string().min(1),
  requesters: z.array(requesterSnapshotSchema),
  sources: z.array(fileSourceGroupSchema).min(1),
  defaultMaxBytes: z.number().int().positive().optional()
});

const contextProviderConfigSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("local-registry"),
    requesters: z.array(requesterSnapshotSchema),
    sources: z.array(contextSourceSchema)
  }),
  fileContextProviderConfigSchema
]);

export type FileContextProviderConfig = z.infer<typeof fileContextProviderConfigSchema>;

type FileSourceGroup = z.infer<typeof fileSourceGroupSchema>;

type FileCandidate =
  | {
      kind: "file";
      relativePath: string;
      absolutePath: string;
      size: number;
    }
  | {
      kind: "excluded";
      relativePath: string;
      reason: string;
      permissionRule: string;
    };

const DEFAULT_FILE_CONTEXT_MAX_BYTES = 32_000;
const DEFAULT_FILE_EXCLUDE_PATTERNS = [
  ".env",
  ".env.*",
  "**/.env",
  "**/.env.*",
  ".git/**",
  "**/.git/**",
  ".ari/**",
  "**/.ari/**",
  "node_modules/**",
  "**/node_modules/**",
  "dist/**",
  "**/dist/**",
  "build/**",
  "**/build/**",
  ".next/**",
  "**/.next/**",
  "*.db",
  "**/*.db",
  "*.sqlite",
  "**/*.sqlite"
];

export function createLocalContextProvider(registry: LocalContextRegistry): ContextProvider {
  const parsed = localContextRegistrySchema.parse(registry);
  const requesters = new Map(parsed.requesters.map((requester) => [requester.requesterId, requester]));

  return {
    getRequesterSnapshot(requesterId) {
      return Promise.resolve(requesters.get(requesterId));
    },
    getCandidateSources() {
      return Promise.resolve(parsed.sources);
    }
  };
}

export function createLocalContextProviderFromFile(filePath: string): ContextProvider {
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  return createLocalContextProvider(localContextRegistrySchema.parse(raw));
}

export function createContextProviderFromConfigFile(filePath: string): ContextProvider {
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  const parsed = contextProviderConfigSchema.parse(raw);

  if (parsed.kind === "local-registry") {
    return createLocalContextProvider(parsed);
  }

  return createFileContextProvider({
    ...parsed,
    root: resolveProviderRoot(filePath, parsed.root)
  });
}

export function createFileContextProvider(config: FileContextProviderConfig): ContextProvider {
  const parsed = fileContextProviderConfigSchema.parse(config);
  const rootPath = resolve(parsed.root);
  const rootRealPath = realpathSync(rootPath);
  const requesters = new Map(parsed.requesters.map((requester) => [requester.requesterId, requester]));
  const sourceGroups = parsed.sources.map(prepareFileSourceGroup);

  return {
    getRequesterSnapshot(requesterId) {
      return Promise.resolve(requesters.get(requesterId));
    },
    getCandidateSources() {
      return Promise.resolve(discoverFileContextSources(rootRealPath, sourceGroups, parsed.defaultMaxBytes));
    }
  };
}

export function createScopePermissionEvaluator(): PermissionEvaluator {
  return {
    evaluate({ request, requester, sources, provenance }) {
      const requesterScopes = new Set(requester.scopes);
      const selected: SelectedContext[] = [];
      const excluded: ExcludedContext[] = [];

      for (const source of sources) {
        if (source.providerExclusionReason) {
          excluded.push({
            sourceId: source.sourceId,
            sourceType: source.sourceType,
            title: source.title,
            reason: source.providerExclusionReason,
            permissionRule: source.providerPermissionRule ?? "provider_excluded"
          });
          continue;
        }

        const missingScopes = source.requiredScopes.filter((scope) => !requesterScopes.has(scope));
        const purposeAllowed = !source.allowedPurposes || source.allowedPurposes.includes(request.purpose);

        if (!purposeAllowed) {
          excluded.push({
            sourceId: source.sourceId,
            sourceType: source.sourceType,
            title: source.title,
            reason: `Purpose ${request.purpose} is outside the allowed purpose boundary for this source.`,
            permissionRule: `purpose in ${JSON.stringify(source.allowedPurposes ?? [])}`
          });
          continue;
        }

        if (missingScopes.length > 0) {
          excluded.push({
            sourceId: source.sourceId,
            sourceType: source.sourceType,
            title: source.title,
            reason: `Requester ${requester.requesterId} lacks required scope(s): ${missingScopes.join(", ")}.`,
            permissionRule: `requires ${source.requiredScopes.join(", ")}`
          });
          continue;
        }

        selected.push({
          sourceId: source.sourceId,
          sourceType: source.sourceType,
          title: source.title,
          content: source.content,
          reason: `Requester ${requester.requesterId} has the required scope boundary for ${request.purpose}.`,
          permissionRule: source.requiredScopes.length > 0 ? `requires ${source.requiredScopes.join(", ")}` : "no additional source scope required"
        });
      }

      return {
        provenance,
        selected,
        excluded
      };
    }
  };
}

function resolveProviderRoot(configFilePath: string, root: string): string {
  return isAbsolute(root) ? root : resolve(dirname(configFilePath), root);
}

function prepareFileSourceGroup(group: FileSourceGroup): FileSourceGroup {
  return {
    ...group,
    include: group.include.map(normalizeContextPattern),
    exclude: group.exclude.map(normalizeContextPattern)
  };
}

function discoverFileContextSources(
  rootRealPath: string,
  sourceGroups: readonly FileSourceGroup[],
  defaultMaxBytes = DEFAULT_FILE_CONTEXT_MAX_BYTES
): ContextSource[] {
  return discoverFileCandidates(rootRealPath).flatMap((candidate) =>
    sourceGroups.flatMap((group) => sourceFromCandidate(rootRealPath, candidate, group, defaultMaxBytes))
  );
}

function discoverFileCandidates(rootRealPath: string): FileCandidate[] {
  const candidates: FileCandidate[] = [];
  const pendingDirectories = [rootRealPath];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();

    if (!currentDirectory) {
      continue;
    }

    for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
      const absolutePath = resolve(currentDirectory, entry.name);
      const relativePath = toContextRelativePath(rootRealPath, absolutePath);

      if (entry.isSymbolicLink()) {
        candidates.push(...candidateFromSymbolicLink(rootRealPath, absolutePath, relativePath));
        continue;
      }

      if (entry.isDirectory()) {
        pendingDirectories.push(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        candidates.push({
          kind: "excluded",
          relativePath,
          reason: "Path is not a regular text file.",
          permissionRule: "file must be a regular file"
        });
        continue;
      }

      const stats = lstatSync(absolutePath);
      candidates.push({
        kind: "file",
        relativePath,
        absolutePath,
        size: stats.size
      });
    }
  }

  return candidates.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function candidateFromSymbolicLink(rootRealPath: string, absolutePath: string, relativePath: string): FileCandidate[] {
  const targetRealPath = realpathSync(absolutePath);

  if (!isPathInsideRoot(rootRealPath, targetRealPath)) {
    return [
      {
        kind: "excluded",
        relativePath,
        reason: "Path is a symbolic link that resolves outside the configured context root.",
        permissionRule: "realpath must stay under context root"
      }
    ];
  }

  const stats = statSync(absolutePath);

  if (!stats.isFile()) {
    return [
      {
        kind: "excluded",
        relativePath,
        reason: "Path is a symbolic link to a non-file target.",
        permissionRule: "file symlink target must be a regular file"
      }
    ];
  }

  return [
    {
      kind: "file",
      relativePath,
      absolutePath,
      size: stats.size
    }
  ];
}

function sourceFromCandidate(
  rootRealPath: string,
  candidate: FileCandidate,
  group: FileSourceGroup,
  defaultMaxBytes: number
): ContextSource[] {
  if (!matchesAnyPattern(group.include, candidate.relativePath)) {
    return [];
  }

  const sourceBase = contextSourceBase(candidate.relativePath, group);
  const defaultExcludePattern = DEFAULT_FILE_EXCLUDE_PATTERNS.find((pattern) => matchesContextPattern(pattern, candidate.relativePath));

  if (defaultExcludePattern) {
    return [
      excludedFileSource(
        sourceBase,
        "File matches ARI's default secret or runtime-file exclusion rules.",
        `default exclude ${defaultExcludePattern}`
      )
    ];
  }

  const configuredExcludePattern = group.exclude.find((pattern) => matchesContextPattern(pattern, candidate.relativePath));

  if (configuredExcludePattern) {
    return [
      excludedFileSource(
        sourceBase,
        "File matches the source group's configured exclusion rules.",
        `exclude ${configuredExcludePattern}`
      )
    ];
  }

  if (candidate.kind === "excluded") {
    return [excludedFileSource(sourceBase, candidate.reason, candidate.permissionRule)];
  }

  if (!isPathInsideRoot(rootRealPath, realpathSync(candidate.absolutePath))) {
    return [
      excludedFileSource(
        sourceBase,
        "File resolves outside the configured context root.",
        "realpath must stay under context root"
      )
    ];
  }

  const maxBytes = group.maxBytes ?? defaultMaxBytes;

  if (candidate.size > maxBytes) {
    return [
      excludedFileSource(
        sourceBase,
        `File exceeds the configured context size limit of ${String(maxBytes)} byte(s).`,
        `size <= ${String(maxBytes)}`
      )
    ];
  }

  const content = readFileSync(candidate.absolutePath);

  if (isProbablyBinary(content)) {
    return [
      excludedFileSource(
        sourceBase,
        "File appears to be binary content and is not safe to return as text context.",
        "content must be UTF-8 text"
      )
    ];
  }

  return [
    {
      ...sourceBase,
      content: content.toString("utf8")
    }
  ];
}

function contextSourceBase(relativePath: string, group: FileSourceGroup): Omit<ContextSource, "content"> {
  return {
    sourceId: `file:${group.sourceType}:${relativePath}`,
    sourceType: group.sourceType,
    title: relativePath,
    requiredScopes: group.requiredScopes,
    allowedPurposes: group.allowedPurposes,
    classification: group.classification
  };
}

function excludedFileSource(
  sourceBase: Omit<ContextSource, "content">,
  reason: string,
  permissionRule: string
): ContextSource {
  return {
    ...sourceBase,
    content: "",
    providerExclusionReason: reason,
    providerPermissionRule: permissionRule
  };
}

function matchesAnyPattern(patterns: readonly string[], relativePath: string): boolean {
  return patterns.some((pattern) => matchesContextPattern(pattern, relativePath));
}

function normalizeContextPattern(pattern: string): string {
  const normalized = pattern.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "/**");

  if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new Error(`Context file pattern must stay inside the configured root: ${pattern}`);
  }

  return normalized;
}

function matchesContextPattern(pattern: string, relativePath: string): boolean {
  return matchPatternSegments(normalizeContextPattern(pattern).split("/"), relativePath.split("/"));
}

function matchPatternSegments(patternSegments: readonly string[], pathSegments: readonly string[]): boolean {
  if (patternSegments.length === 0) {
    return pathSegments.length === 0;
  }

  const [currentPatternSegment, ...remainingPatternSegments] = patternSegments;

  if (!currentPatternSegment) {
    return pathSegments.length === 0;
  }

  if (currentPatternSegment === "**") {
    if (remainingPatternSegments.length === 0) {
      return true;
    }

    for (let index = 0; index <= pathSegments.length; index += 1) {
      if (matchPatternSegments(remainingPatternSegments, pathSegments.slice(index))) {
        return true;
      }
    }

    return false;
  }

  const [currentPathSegment, ...remainingPathSegments] = pathSegments;

  if (!currentPathSegment || !matchesPathSegment(currentPatternSegment, currentPathSegment)) {
    return false;
  }

  return matchPatternSegments(remainingPatternSegments, remainingPathSegments);
}

function matchesPathSegment(patternSegment: string, pathSegment: string): boolean {
  const escaped = patternSegment
    .split("*")
    .map((part) => part.replace(/[|\\{}()[\]^$+?.]/g, "\\$&"))
    .join("[^/]*");
  return new RegExp(`^${escaped}$`).test(pathSegment);
}

function toContextRelativePath(rootRealPath: string, absolutePath: string): string {
  return relative(rootRealPath, absolutePath).split("\\").join("/");
}

function isPathInsideRoot(rootRealPath: string, targetRealPath: string): boolean {
  const relativePath = relative(rootRealPath, targetRealPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function isProbablyBinary(content: Buffer): boolean {
  const scanLength = Math.min(content.length, 512);

  if (scanLength === 0) {
    return false;
  }

  let controlByteCount = 0;

  for (let index = 0; index < scanLength; index += 1) {
    const byte = content[index];

    if (byte === 0) {
      return true;
    }

    if (byte !== undefined && byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      controlByteCount += 1;
    }
  }

  return controlByteCount / scanLength > 0.1;
}
