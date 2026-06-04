import type { Config } from "../config.js";
import type { ModelSettingProvider } from "../settings/store.js";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmRequest = {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  enableThinking?: boolean;
  signal?: AbortSignal;
};

export type LlmResponse = {
  content: string;
  reasoningContent?: string;
  finishReason?: string;
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
    const requestInit: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.llmApiKey}`,
      },
      body: JSON.stringify({
        model: this.settings?.getLlmModel() ?? this.config.llmModel,
        messages: request.messages,
        chat_template_kwargs: {
          enable_thinking:
            request.enableThinking ?? this.config.llmEnableThinking,
        },
        cache_prompt: true,
        temperature: request.temperature ?? this.config.llmTemperature,
        max_tokens: request.maxTokens ?? this.config.llmMaxTokens,
      }),
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
    if (json.timings) result.timings = json.timings;
    result.raw = json;
    return result;
  }
}

type OpenAiModelsResponse = {
  data: Array<{ id?: string }>;
};

type LlamaChatCompletionResponse = {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      role?: string;
      content?: string;
      reasoning_content?: string;
    };
  }>;
  timings?: unknown;
};
