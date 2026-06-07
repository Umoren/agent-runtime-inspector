import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

const optionalString = z.preprocess(emptyStringToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(emptyStringToUndefined, z.string().url().optional());

const envSchema = z.object({
  ARI_COLLECTOR_URL: z.preprocess(emptyStringToUndefined, z.string().url().default("http://localhost:4319")),
  MERGE_AGENT_HANDLER_MCP_URL: optionalUrl,
  MERGE_REGISTERED_USER_ID: optionalString,
  MERGE_TOOL_PACK_ID: optionalString,
  MERGE_API_KEY: optionalString,
  MERGE_TOOL_NAME: optionalString,
  MERGE_TOOL_ARGUMENTS_JSON: z.preprocess(emptyStringToUndefined, z.string().min(2).optional()),
  ARI_MODEL_PROVIDER: z.preprocess(emptyStringToUndefined, z.string().min(1).default("openai-compatible")),
  ARI_MODEL_BASE_URL: optionalUrl,
  ARI_MODEL_API_KEY: optionalString,
  ARI_MODEL_NAME: optionalString,
  ARI_MODEL_PROMPT: optionalString,
  ARI_AGENT_WORKFLOW: optionalString,
  ARI_GITHUB_OWNER: optionalString,
  ARI_GITHUB_REPO: optionalString,
  ARI_GITHUB_LABELS_JSON: z.preprocess(emptyStringToUndefined, z.string().min(2).optional())
});

export type ExampleEnv = z.infer<typeof envSchema>;

export function readExampleEnv(input: NodeJS.ProcessEnv = process.env): ExampleEnv {
  loadNearestEnvFile();
  return envSchema.parse(input);
}

export function hasMergeConfig(env: ExampleEnv): env is ExampleEnv & {
  MERGE_AGENT_HANDLER_MCP_URL: string;
  MERGE_REGISTERED_USER_ID: string;
  MERGE_TOOL_PACK_ID: string;
  MERGE_API_KEY: string;
} {
  return Boolean(
    env.MERGE_AGENT_HANDLER_MCP_URL &&
      env.MERGE_REGISTERED_USER_ID &&
      env.MERGE_TOOL_PACK_ID &&
      env.MERGE_API_KEY
  );
}

export function missingMergeConfig(env: ExampleEnv): string[] {
  const required = [
    ["MERGE_AGENT_HANDLER_MCP_URL", env.MERGE_AGENT_HANDLER_MCP_URL],
    ["MERGE_REGISTERED_USER_ID", env.MERGE_REGISTERED_USER_ID],
    ["MERGE_TOOL_PACK_ID", env.MERGE_TOOL_PACK_ID],
    ["MERGE_API_KEY", env.MERGE_API_KEY]
  ] as const;

  const missing: string[] = [];

  for (const [name, value] of required) {
    if (!value) {
      missing.push(name);
    }
  }

  return missing;
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
