import type { Config } from "../config.js";
import type { ModelSettingProvider } from "../settings/store.js";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: unknown;
  };
};

export type LlmToolChoice =
  | "auto"
  | "none"
  | {
      type: "function";
      function: { name: string };
    };

export type LlmToolCall = {
  id?: string | undefined;
  type: "function";
  name: string;
  arguments: string;
};

export type LlmRequest = {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  enableThinking?: boolean;
  tools?: readonly LlmTool[];
  toolChoice?: LlmToolChoice;
  signal?: AbortSignal;
};

export type LlmResponse = {
  content: string;
  reasoningContent?: string;
  finishReason?: string;
  toolCalls?: LlmToolCall[];
  timings?: unknown;
  raw?: unknown;
};

export class LlmClient {
  constructor(
    private readonly config: Config,
    private readonly settings?: ModelSettingProvider,
  ) {}

  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.config.llmBaseUrl}/models`, {
      headers: { Authorization: `Bearer ${this.config.llmApiKey}` },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `LLM models request failed: ${response.status} ${response.statusText} ${body}`,
      );
    }

    const json = (await response.json()) as OpenAiModelsResponse;
    return json.data
      .map((model) => model.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const body: LlamaChatCompletionRequest = {
      model: this.settings?.getLlmModel() ?? this.config.llmModel,
      messages: request.messages,
      chat_template_kwargs: {
        enable_thinking:
          request.enableThinking ?? this.config.llmEnableThinking,
      },
      cache_prompt: true,
      temperature: request.temperature ?? this.config.llmTemperature,
      max_tokens: request.maxTokens ?? this.config.llmMaxTokens,
    };
    if (request.tools) body.tools = [...request.tools];
    if (request.toolChoice) body.tool_choice = request.toolChoice;

    const requestInit: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.llmApiKey}`,
      },
      body: JSON.stringify(body),
    };
    if (request.signal) requestInit.signal = request.signal;

    const response = await fetch(
      `${this.config.llmBaseUrl}/chat/completions`,
      requestInit,
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `LLM request failed: ${response.status} ${response.statusText} ${body}`,
      );
    }

    const json = (await response.json()) as LlamaChatCompletionResponse;
    const choice = json.choices?.[0];
    const content = choice?.message?.content ?? "";

    const result: LlmResponse = { content };
    if (choice?.message?.reasoning_content)
      result.reasoningContent = choice.message.reasoning_content;
    if (choice?.finish_reason) result.finishReason = choice.finish_reason;
    const toolCalls = parseToolCalls(choice?.message?.tool_calls);
    if (toolCalls.length > 0) result.toolCalls = toolCalls;
    if (json.timings) result.timings = json.timings;
    result.raw = json;
    return result;
  }
}

type OpenAiModelsResponse = {
  data: Array<{ id?: string }>;
};

type LlamaChatCompletionRequest = {
  model: string;
  messages: LlmMessage[];
  chat_template_kwargs: { enable_thinking: boolean };
  cache_prompt: boolean;
  temperature: number;
  max_tokens: number;
  tools?: LlmTool[] | undefined;
  tool_choice?: LlmToolChoice | undefined;
};

type LlamaChatCompletionResponse = {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      role?: string;
      content?: string;
      reasoning_content?: string;
      tool_calls?: unknown;
    };
  }>;
  timings?: unknown;
};

function parseToolCalls(toolCalls: unknown): LlmToolCall[] {
  if (!Array.isArray(toolCalls)) return [];

  return toolCalls.flatMap((toolCall) => {
    if (!toolCall || typeof toolCall !== "object") return [];
    const input = toolCall as {
      id?: unknown;
      type?: unknown;
      function?: { name?: unknown; arguments?: unknown };
    };
    if (input.type !== "function") return [];
    const name = input.function?.name;
    const args = input.function?.arguments;
    if (typeof name !== "string") return [];

    const parsed: LlmToolCall = {
      type: "function",
      name,
      arguments: typeof args === "string" ? args : "{}",
    };
    if (typeof input.id === "string") parsed.id = input.id;
    return [parsed];
  });
}
