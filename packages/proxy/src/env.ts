import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

const optionalString = z.preprocess(emptyStringToUndefined, z.string().min(1).optional());

const proxyEnvSchema = z.object({
  ARI_COLLECTOR_URL: z.preprocess(emptyStringToUndefined, z.string().url().default("http://localhost:4319")),
  MERGE_AGENT_HANDLER_MCP_URL: z.string().url(),
  MERGE_REGISTERED_USER_ID: z.string().min(1),
  MERGE_TOOL_PACK_ID: z.string().min(1),
  MERGE_API_KEY: optionalString
});

export type ProxyEnv = z.infer<typeof proxyEnvSchema>;

export function readProxyEnv(input: NodeJS.ProcessEnv = process.env): ProxyEnv {
  loadNearestEnvFile();
  return proxyEnvSchema.parse(input);
}

function emptyStringToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

function loadNearestEnvFile(startDirectory = process.cwd()): void {
  const envPath = findNearestFile(".env", startDirectory);

  if (!envPath) {
    return;
  }

  process.loadEnvFile(envPath);
  loadEnvFileOverBlankValues(envPath);
}

function findNearestFile(fileName: string, startDirectory: string): string | null {
  let currentDirectory = startDirectory;

  while (true) {
    const candidate = join(currentDirectory, fileName);

    if (existsSync(candidate)) {
      return candidate;
    }

    const parentDirectory = dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return null;
    }

    currentDirectory = parentDirectory;
  }
}

function loadEnvFileOverBlankValues(envPath: string): void {
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const parsed = parseEnvLine(line);

    if (!parsed) {
      continue;
    }

    if (!process.env[parsed.name]) {
      process.env[parsed.name] = parsed.value;
    }
  }
}

function parseEnvLine(line: string): { name: string; value: string } | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");

  if (separatorIndex === -1) {
    return null;
  }

  const name = trimmed.slice(0, separatorIndex).trim();
  const rawValue = trimmed.slice(separatorIndex + 1).trim();

  if (!name) {
    return null;
  }

  return {
    name,
    value: unquoteEnvValue(rawValue)
  };
}

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
