import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function envValue(name: string): string | undefined {
  return process.env[name] || readNearestEnvFile()[name];
}

export function readNearestEnvFile(startDirectory = process.cwd()): Record<string, string> {
  const envPath = findNearestFile(".env", startDirectory);

  if (!envPath) {
    return {};
  }

  const values: Record<string, string> = {};
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const parsed = parseEnvLine(line);

    if (parsed) {
      values[parsed.name] = parsed.value;
    }
  }

  return values;
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
