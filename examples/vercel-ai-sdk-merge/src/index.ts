import { createHttpRecorder, createModelCalledEvent, createModelCompletedEvent } from "@ari/ai-sdk";
import type { TraceEvent } from "@ari/core";
import { createMergeAgentHandlerClient, createMcpSdkTransport } from "@ari/merge";
import { hasMergeConfig, missingMergeConfig, readExampleEnv } from "./env.js";

const env = readExampleEnv();
const recorder = createHttpRecorder({ collectorUrl: env.ARI_COLLECTOR_URL });
const runId = `run_${crypto.randomUUID()}`;

type IssueDraft = {
  title: string;
  body: string;
};

type ModelStepResult =
  | {
      ok: true;
      issueDraft: IssueDraft;
    }
  | {
      ok: false;
      errorMessage: string;
    };

type ToolCallConfig = {
  name: string;
  argumentsJson?: string;
};

await record({
  id: crypto.randomUUID(),
  runId,
  type: "run.started",
  path: "system",
  source: "collector",
  timestamp: new Date().toISOString(),
  payload: {
    title: "Merge Agent Handler connected run",
    scenario: "List Agent Handler tools and optionally call one configured tool."
  }
});

await recordExampleContext();
const modelStep = await recordModelStep();

if (!hasMergeConfig(env)) {
  const missing = missingMergeConfig(env);

  console.log("Missing Merge Agent Handler config. The example recorded the run/model path only.");
  console.log(`Set these values to inspect tools: ${missing.join(", ")}`);
  await finishRun("success", "Example run recorded without Merge credentials.");
  process.exit(0);
}

const mergeConfig = {
  mcpUrl: env.MERGE_AGENT_HANDLER_MCP_URL,
  registeredUserId: env.MERGE_REGISTERED_USER_ID,
  toolPackId: env.MERGE_TOOL_PACK_ID,
  ...(env.MERGE_API_KEY ? { apiKey: env.MERGE_API_KEY } : {})
};

let transport: Awaited<ReturnType<typeof createMcpSdkTransport>> | undefined;

try {
  transport = await createMcpSdkTransport(mergeConfig);
  const merge = createMergeAgentHandlerClient(
    {
      mcpUrl: env.MERGE_AGENT_HANDLER_MCP_URL,
      registeredUserId: env.MERGE_REGISTERED_USER_ID,
      toolPackId: env.MERGE_TOOL_PACK_ID,
      ...(env.MERGE_API_KEY ? { apiKey: env.MERGE_API_KEY } : {})
    },
    transport
  );

  const listed = await merge.listTools(runId);

  if (!listed.ok) {
    await finishRun("error", listed.error.message);
    process.exit(1);
  }

  await record(listed.data.event);

  console.log(`Recorded ${listed.data.tools.length} Merge Agent Handler tools.`);
  printToolPreview(listed.data.tools);

  const toolCall = resolveToolCall(modelStep);

  if (toolCall) {
    const parsedArguments = parseToolArguments(toolCall.argumentsJson);

    if (!parsedArguments.ok) {
      await finishRun("error", parsedArguments.message);
      process.exit(1);
    }

    const called = await merge.callTool({
      runId,
      toolName: toolCall.name,
      arguments: parsedArguments.arguments
    });

    if (!called.ok) {
      await finishRun("error", called.error.message);
      process.exit(1);
    }

    await record(called.data.started);
    await record(called.data.completed);
    await finishRun(
      called.data.completed.type === "tool.completed" ? called.data.completed.payload.status : "success",
      called.data.completed.type === "tool.completed" && called.data.completed.payload.status === "error"
        ? `Merge Agent Handler listed tools, called ${toolCall.name}, and the tool returned an error.`
        : `Merge Agent Handler listed tools and called ${toolCall.name}.`
    );
  } else {
    await finishRun(
      "success",
      "Merge Agent Handler tools were listed. Set MERGE_TOOL_NAME or ARI_AGENT_WORKFLOW=github_issue to record a tool call."
    );
  }

  console.log(`Open http://localhost:3005/runs/${runId}`);
} catch (error) {
  const message = errorMessage(error);
  await finishRun("error", `Merge Agent Handler request failed: ${message}`);
  console.error(`Merge Agent Handler request failed: ${message}`);
  console.log(`Open http://localhost:3005/runs/${runId}`);
  process.exitCode = 1;
} finally {
  await transport?.close?.();
}

async function record(event: TraceEvent): Promise<void> {
  await recorder.record(event);
}

async function finishRun(status: "success" | "error", summary: string): Promise<void> {
  await record({
    id: crypto.randomUUID(),
    runId,
    type: "run.completed",
    path: "system",
    source: "collector",
    timestamp: new Date().toISOString(),
    payload: {
      status,
      summary
    }
  });
}

async function recordExampleContext(): Promise<void> {
  await record({
    id: crypto.randomUUID(),
    runId,
    type: "context.selected",
    path: "context",
    source: "collector",
    timestamp: new Date().toISOString(),
    payload: {
      sourceId: "support_ticket_checkout_failure",
      sourceType: "support_ticket",
      title: "Customer escalation: checkout failure after SSO login",
      reason: "The requester can access the support ticket and customer account.",
      permissionRule: "support_team_member"
    }
  });

  await record({
    id: crypto.randomUUID(),
    runId,
    type: "context.excluded",
    path: "context",
    source: "collector",
    timestamp: new Date().toISOString(),
    payload: {
      sourceId: "private_slack_finance_note",
      sourceType: "slack_message",
      title: "Private finance escalation note",
      reason: "The requester is not a member of the source channel.",
      permissionRule: "source_channel_member"
    }
  });
}

async function recordModelStep(): Promise<ModelStepResult> {
  if (!env.ARI_MODEL_API_KEY || !env.ARI_MODEL_NAME) {
    await record(
      createModelCalledEvent({
        runId,
        taskType: "issue_draft",
        provider: "example",
        model: "manual",
        routeReason: "Set ARI_MODEL_API_KEY and ARI_MODEL_NAME to record a live model call."
      })
    );

    await record(
      createModelCompletedEvent({
        runId,
        provider: "example",
        model: "manual",
        status: "success",
        latencyMs: 0
      })
    );
    return {
      ok: true,
      issueDraft: defaultIssueDraft()
    };
  }

  const provider = env.ARI_MODEL_PROVIDER;
  const model = env.ARI_MODEL_NAME;
  const startedAt = performance.now();

  await record(
    createModelCalledEvent({
      runId,
      taskType: "issue_draft",
      provider,
      model,
      routeReason: "Draft a concise GitHub issue from the selected support context."
    })
  );

  try {
    const result = await callChatCompletionsModel({
      apiKey: env.ARI_MODEL_API_KEY,
      provider,
      model,
      prompt: env.ARI_MODEL_PROMPT ?? defaultModelPrompt(),
      ...(env.ARI_MODEL_BASE_URL === undefined ? {} : { baseUrl: env.ARI_MODEL_BASE_URL })
    });

    await record(
      createModelCompletedEvent({
        runId,
        provider,
        model,
        status: "success",
        latencyMs: elapsedMs(startedAt),
        ...(result.inputTokens === undefined ? {} : { inputTokens: result.inputTokens }),
        ...(result.outputTokens === undefined ? {} : { outputTokens: result.outputTokens })
      })
    );
    return {
      ok: true,
      issueDraft: result.issueDraft
    };
  } catch (error) {
    const message = errorMessage(error);
    await record(
      createModelCompletedEvent({
        runId,
        provider,
        model,
        status: "error",
        latencyMs: elapsedMs(startedAt),
        errorMessage: message
      })
    );
    return {
      ok: false,
      errorMessage: message
    };
  }
}

function resolveToolCall(modelStep: ModelStepResult): ToolCallConfig | undefined {
  if (env.ARI_AGENT_WORKFLOW === "github_issue") {
    if (!modelStep.ok) {
      throw new Error(`Model step failed: ${modelStep.errorMessage}`);
    }

    const workflowArgs = buildGithubIssueArguments(modelStep.issueDraft);

    if (!workflowArgs.ok) {
      throw new Error(workflowArgs.message);
    }

    return {
      name: "github__create_issue",
      argumentsJson: JSON.stringify(workflowArgs.arguments)
    };
  }

  if (env.MERGE_TOOL_NAME) {
    return {
      name: env.MERGE_TOOL_NAME,
      ...(env.MERGE_TOOL_ARGUMENTS_JSON === undefined ? {} : { argumentsJson: env.MERGE_TOOL_ARGUMENTS_JSON })
    };
  }

  return undefined;
}

function buildGithubIssueArguments(modelDraft: IssueDraft | undefined):
  | {
      ok: true;
      arguments: Record<string, unknown>;
    }
  | {
      ok: false;
      message: string;
    } {
  if (!env.ARI_GITHUB_OWNER || !env.ARI_GITHUB_REPO) {
    return {
      ok: false,
      message: "Set ARI_GITHUB_OWNER and ARI_GITHUB_REPO when ARI_AGENT_WORKFLOW=github_issue."
    };
  }

  if (!modelDraft) {
    return {
      ok: false,
      message: "The model did not produce an issue draft."
    };
  }

  const labels = parseStringArray(env.ARI_GITHUB_LABELS_JSON);

  if (!labels.ok) {
    return labels;
  }

  return {
    ok: true,
    arguments: {
      input: {
        owner: env.ARI_GITHUB_OWNER,
        repo: env.ARI_GITHUB_REPO,
        title: modelDraft.title,
        body: modelDraft.body,
        labels: labels.data.length === 0 ? null : labels.data,
        assignee: null,
        assignees: null,
        milestone: null
      }
    }
  };
}

function parseToolArguments(input: string | undefined):
  | {
      ok: true;
      arguments: Record<string, unknown>;
    }
  | {
      ok: false;
      message: string;
    } {
  if (!input) {
    return {
      ok: true,
      arguments: {}
    };
  }

  try {
    const parsed: unknown = JSON.parse(input);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        message: "MERGE_TOOL_ARGUMENTS_JSON must be a JSON object."
      };
    }

    return {
      ok: true,
      arguments: parsed as Record<string, unknown>
    };
  } catch (error) {
    return {
      ok: false,
      message: `MERGE_TOOL_ARGUMENTS_JSON is invalid JSON: ${error instanceof Error ? error.message : "unknown parse error"}`
    };
  }
}

function printToolPreview(tools: readonly { name: string }[]): void {
  const preview = tools.slice(0, 12);

  if (preview.length === 0) {
    console.log("No tools were returned for this Tool Pack and Registered User.");
    return;
  }

  console.log("Sample tools:");
  for (const tool of preview) {
    console.log(`- ${tool.name}`);
  }
  if (tools.length > preview.length) {
    console.log(`... ${tools.length - preview.length} more tools`);
  }
}

async function callChatCompletionsModel(input: {
  apiKey: string;
  provider: string;
  baseUrl?: string;
  model: string;
  prompt: string;
}): Promise<{
  issueDraft: IssueDraft;
  inputTokens?: number;
  outputTokens?: number;
}> {
  if (input.provider === "anthropic") {
    return callAnthropicMessagesModel(input);
  }

  return callOpenAiCompatibleModel({
    ...input,
    baseUrl: input.baseUrl ?? "https://api.openai.com/v1"
  });
}

async function callOpenAiCompatibleModel(input: {
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt: string;
}): Promise<{
  issueDraft: IssueDraft;
  inputTokens?: number;
  outputTokens?: number;
}> {
  const response = await fetch(chatCompletionsUrl(input.baseUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You draft concise engineering issue summaries from support context. Return only JSON with title and body string fields."
        },
        {
          role: "user",
          content: input.prompt
        }
      ]
    }),
    signal: AbortSignal.timeout(20_000)
  });

  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error(`Model provider returned ${String(response.status)}: ${JSON.stringify(body)}`);
  }

  const usage = readUsage(body);
  const content = readAssistantContent(body);
  const issueDraft = parseIssueDraft(content);

  return {
    issueDraft,
    ...(usage.inputTokens === undefined ? {} : { inputTokens: usage.inputTokens }),
    ...(usage.outputTokens === undefined ? {} : { outputTokens: usage.outputTokens })
  };
}

async function callAnthropicMessagesModel(input: {
  apiKey: string;
  baseUrl?: string;
  model: string;
  prompt: string;
}): Promise<{
  issueDraft: IssueDraft;
  inputTokens?: number;
  outputTokens?: number;
}> {
  const response = await fetch(anthropicMessagesUrl(input.baseUrl), {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": input.apiKey
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: 400,
      system: "You draft concise engineering issue summaries from support context. Return only JSON with title and body string fields.",
      messages: [
        {
          role: "user",
          content: input.prompt
        }
      ]
    }),
    signal: AbortSignal.timeout(20_000)
  });

  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error(`Anthropic returned ${String(response.status)}: ${JSON.stringify(body)}`);
  }

  const content = readAnthropicAssistantContent(body);
  const usage = readUsage(body);

  return {
    issueDraft: parseIssueDraft(content),
    ...(usage.inputTokens === undefined ? {} : { inputTokens: usage.inputTokens }),
    ...(usage.outputTokens === undefined ? {} : { outputTokens: usage.outputTokens })
  };
}

function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function anthropicMessagesUrl(baseUrl: string | undefined): string {
  return `${(baseUrl ?? "https://api.anthropic.com/v1").replace(/\/$/, "")}/messages`;
}

function readUsage(body: unknown): {
  inputTokens?: number;
  outputTokens?: number;
} {
  if (!body || typeof body !== "object") {
    return {};
  }

  const usage = (body as { usage?: unknown }).usage;

  if (!usage || typeof usage !== "object") {
    return {};
  }

  const candidate = usage as {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    input_tokens?: unknown;
    output_tokens?: unknown;
  };
  const inputTokens = numberOrUndefined(candidate.prompt_tokens ?? candidate.input_tokens);
  const outputTokens = numberOrUndefined(candidate.completion_tokens ?? candidate.output_tokens);

  return {
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens })
  };
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readAssistantContent(body: unknown): string {
  if (!body || typeof body !== "object") {
    throw new Error("Model provider response was not an object.");
  }

  const choices = (body as { choices?: unknown }).choices;

  if (!Array.isArray(choices)) {
    throw new Error("Model provider response did not include choices.");
  }

  const firstChoice = choices[0] as { message?: { content?: unknown } } | undefined;
  const content = firstChoice?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Model provider response did not include assistant content.");
  }

  return content;
}

function readAnthropicAssistantContent(body: unknown): string {
  if (!body || typeof body !== "object") {
    throw new Error("Anthropic response was not an object.");
  }

  const content = (body as { content?: unknown }).content;

  if (!Array.isArray(content)) {
    throw new Error("Anthropic response did not include content blocks.");
  }

  const text = content
    .map((block) => {
      if (!block || typeof block !== "object") {
        return "";
      }

      const candidate = block as { type?: unknown; text?: unknown };
      return candidate.type === "text" && typeof candidate.text === "string" ? candidate.text : "";
    })
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Anthropic response did not include text content.");
  }

  return text;
}

function parseIssueDraft(content: string): IssueDraft {
  const jsonText = extractJsonObject(content);
  const parsed: unknown = JSON.parse(jsonText);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Model issue draft was not a JSON object.");
  }

  const candidate = parsed as { title?: unknown; body?: unknown };

  if (typeof candidate.title !== "string" || !candidate.title.trim()) {
    throw new Error("Model issue draft did not include a title.");
  }

  if (typeof candidate.body !== "string" || !candidate.body.trim()) {
    throw new Error("Model issue draft did not include a body.");
  }

  return {
    title: candidate.title.trim(),
    body: candidate.body.trim()
  };
}

function extractJsonObject(content: string): string {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not contain a JSON object.");
  }

  return trimmed.slice(start, end + 1);
}

function defaultModelPrompt(): string {
  return [
    "Selected context:",
    "- Support ticket: Customer reports checkout failure after SSO login.",
    "- Customer account: Enterprise plan, active escalation.",
    "",
    "Excluded context:",
    "- Private finance Slack note. The requester cannot access that source.",
    "",
    "Task:",
    "Draft a short GitHub issue title and body using only the selected context.",
    "Return only JSON in this shape:",
    "{\"title\":\"...\",\"body\":\"...\"}"
  ].join("\n");
}

function defaultIssueDraft(): IssueDraft {
  return {
    title: "Investigate checkout failure after SSO login",
    body: [
      "A customer on the Enterprise plan reported checkout failures after SSO login.",
      "",
      "Context used:",
      "- Support ticket: checkout failure after SSO login",
      "- Customer account: active escalation",
      "",
      "Excluded context:",
      "- Private finance Slack note was not used because the requester cannot access that source."
    ].join("\n")
  };
}

function parseStringArray(input: string | undefined):
  | {
      ok: true;
      data: string[];
    }
  | {
      ok: false;
      message: string;
    } {
  if (!input) {
    return {
      ok: true,
      data: []
    };
  }

  try {
    const parsed: unknown = JSON.parse(input);

    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string" && item.trim())) {
      return {
        ok: false,
        message: "ARI_GITHUB_LABELS_JSON must be a JSON array of strings."
      };
    }

    return {
      ok: true,
      data: parsed.map((item) => item.trim())
    };
  } catch (error) {
    return {
      ok: false,
      message: `ARI_GITHUB_LABELS_JSON is invalid JSON: ${error instanceof Error ? error.message : "unknown parse error"}`
    };
  }
}

function elapsedMs(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
