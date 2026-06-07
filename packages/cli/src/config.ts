import { access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { z } from "zod";
import type { Result } from "@ari/core";
import { err, ok } from "@ari/core";

export const ariConfigSchema = z.object({
  collectorUrl: z.string().url(),
  dashboardUrl: z.string().url(),
  merge: z.object({
    agentHandlerMcpUrl: z.string().url().optional(),
    registeredUserId: z.string().optional(),
    toolPackId: z.string().optional()
  })
});

export type AriConfig = z.infer<typeof ariConfigSchema>;

export const defaultConfig: AriConfig = {
  collectorUrl: "http://localhost:4319",
  dashboardUrl: "http://localhost:3005",
  merge: {}
};

export async function writeDefaultConfig(path = "ari.config.json"): Promise<Result<AriConfig, string>> {
  const exists = await fileExists(path);

  if (exists) {
    return err(`${path} already exists`);
  }

  await writeFile(path, `${JSON.stringify(defaultConfig, null, 2)}\n`, "utf8");
  return ok(defaultConfig);
}

export async function readConfig(path = "ari.config.json"): Promise<Result<AriConfig, string>> {
  if (!(await fileExists(path))) {
    return ok(defaultConfig);
  }

  const content = await readFile(path, "utf8");
  const parsedJson: unknown = JSON.parse(content);
  const parsed = ariConfigSchema.safeParse(parsedJson);

  if (!parsed.success) {
    return err(parsed.error.message);
  }

  return ok(parsed.data);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
