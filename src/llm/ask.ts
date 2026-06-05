import type { Logger } from "../logger.js";
import type {
  LlmClient,
  LlmMessage,
  LlmRequest,
  LlmResponse,
  LlmTool,
  LlmToolChoice,
} from "./client.js";

export type AskLlmBaseInput = {
  llm: LlmClient;
  logger: Logger;
  messages: LlmMessage[];
  label?: string | undefined;
  signal?: AbortSignal | undefined;
  timeoutMs: number;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  enableThinking?: boolean | undefined;
  tools?: readonly LlmTool[] | undefined;
  toolChoice?: LlmToolChoice | undefined;
};

export function askLlm(input: AskLlmBaseInput): Promise<LlmResponse>;
export function askLlm<T>(
  input: AskLlmBaseInput & {
    parse(response: LlmResponse): T | Promise<T>;
  },
): Promise<T>;
export async function askLlm<T>(
  input: AskLlmBaseInput & {
    parse?(response: LlmResponse): T | Promise<T>;
  },
): Promise<LlmResponse | T> {
  const signal = withTimeoutSignal(input.signal, input.timeoutMs);

  try {
    const request: LlmRequest = {
      messages: input.messages,
      signal: signal.signal,
    };
    if (input.temperature !== undefined)
      request.temperature = input.temperature;
    if (input.maxTokens !== undefined) request.maxTokens = input.maxTokens;
    if (input.enableThinking !== undefined)
      request.enableThinking = input.enableThinking;
    if (input.tools !== undefined) request.tools = input.tools;
    if (input.toolChoice !== undefined) request.toolChoice = input.toolChoice;

    const response = await input.llm.complete(request);

    input.logger.debug(
      {
        label: input.label,
        finishReason: response.finishReason,
        timings: response.timings,
      },
      "llm ask complete",
    );

    return input.parse ? input.parse(response) : response;
  } finally {
    signal.cleanup();
  }
}

function withTimeoutSignal(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();

  const abort = () => controller.abort();
  if (parent?.aborted) {
    controller.abort();
  } else {
    parent?.addEventListener("abort", abort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", abort);
    },
  };
}
