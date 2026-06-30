import { readFileSync } from "node:fs";
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

const localContextRegistrySchema = z.object({
  requesters: z.array(
    z.object({
      requesterId: z.string().min(1),
      scopes: z.array(z.string().min(1)).default([])
    })
  ),
  sources: z.array(
    z.object({
      sourceId: z.string().min(1),
      sourceType: z.string().min(1),
      title: z.string().min(1),
      content: z.string().min(1),
      requiredScopes: z.array(z.string().min(1)).default([]),
      allowedPurposes: z.array(z.string().min(1)).optional(),
      classification: z.string().min(1).optional()
    })
  )
});

type LocalContextRegistry = z.infer<typeof localContextRegistrySchema>;

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

export function createScopePermissionEvaluator(): PermissionEvaluator {
  return {
    evaluate({ request, requester, sources, provenance }) {
      const requesterScopes = new Set(requester.scopes);
      const selected: SelectedContext[] = [];
      const excluded: ExcludedContext[] = [];

      for (const source of sources) {
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
