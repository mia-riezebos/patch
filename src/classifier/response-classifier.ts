import { ChannelType, type Message } from "discord.js";
import { summarizeContext } from "../conversation/context.js";
import {
  buildTranscript,
  formatTranscript,
} from "../conversation/transcript.js";
import type { ConversationMessage } from "../conversation/types.js";
import type { LlmClient, LlmMessage } from "../llm/client.js";
import type { Logger } from "../logger.js";
import {
  type ClassifierPromptContext,
  buildClassifierMessages,
} from "../prompts/classifier.js";

const CLASSIFIER_MAX_TOKENS = 96;

export type ClassifierDecision = {
  shouldRespond: boolean;
  confidence: number;
  reason: string;
};

export async function classifyShouldRespond(options: {
  message: Message;
  botUserId: string;
  llm: LlmClient;
  logger: Logger;
  llmTraceLogging: boolean;
  contextMessages: ConversationMessage[];
}): Promise<ClassifierDecision> {
  const { message, botUserId, llm, logger, llmTraceLogging, contextMessages } =
    options;
  const log = logger.child({
    messageId: message.id,
    channelId: message.channelId,
    operation: "response-classifier",
  });

  const transcript = formatTranscript(
    buildTranscript(contextMessages, botUserId),
  );
  const promptContext = buildClassifierPromptContext(message, botUserId);
  const messages = buildClassifierMessages(transcript, promptContext);

  if (llmTraceLogging) {
    log.debug(
      {
        context: summarizeContext(contextMessages),
        classifierContext: promptContext,
        transcript,
        promptMessages: messages,
      },
      "classifier prompt trace",
    );
  }

  const response = await llm.complete({
    messages,
    temperature: 0,
    maxTokens: CLASSIFIER_MAX_TOKENS,
    enableThinking: false,
  });
  const parsed = parseClassifierDecision(response.content);

  if (parsed.valid) {
    log.debug(
      {
        decision: parsed.decision,
        rawContent: response.content,
        reasoningContentLength: response.reasoningContent?.length ?? 0,
        finishReason: response.finishReason,
        timings: response.timings,
      },
      "classifier decision",
    );

    return parsed.decision;
  }

  log.warn(
    {
      decision: parsed.decision,
      rawContent: response.content,
      reasoningContentLength: response.reasoningContent?.length ?? 0,
      finishReason: response.finishReason,
      timings: response.timings,
    },
    "classifier returned invalid JSON; retrying JSON repair",
  );

  const repaired = await repairClassifierDecision({
    llm,
    messages,
    rawContent: response.content,
  });
  const repairedParsed = parseClassifierDecision(repaired.content);
  const decision = repairedParsed.decision;

  log.debug(
    {
      decision,
      rawContent: repaired.content,
      originalRawContent: response.content,
      repaired: repairedParsed.valid,
      reasoningContentLength: repaired.reasoningContent?.length ?? 0,
      finishReason: repaired.finishReason,
      timings: repaired.timings,
    },
    "classifier decision",
  );

  return decision;
}

function buildClassifierPromptContext(
  message: Message,
  botUserId: string,
): ClassifierPromptContext {
  const channelName =
    "name" in message.channel ? message.channel.name : undefined;
  const replyToMessageId = message.reference?.messageId;

  return {
    triggerKind: message.inGuild() ? "passive_guild_message" : "dm_message",
    location: classifyLocation(message),
    botUserId,
    latestMessage: {
      id: message.id,
      authorId: message.author.id,
      authorName: message.author.displayName,
      ...(replyToMessageId ? { replyToMessageId } : {}),
      userMentionCount: message.mentions.users.size,
      roleMentionCount: message.mentions.roles.size,
      mentionsEveryone: message.mentions.everyone,
      attachmentCount: message.attachments.size,
    },
    channel: {
      id: message.channelId,
      type: ChannelType[message.channel.type] ?? String(message.channel.type),
      ...(channelName ? { name: channelName } : {}),
    },
  };
}

function classifyLocation(
  message: Message,
): ClassifierPromptContext["location"] {
  if (!message.inGuild()) return "dm";
  return message.channel.isThread() ? "guild_thread" : "guild_channel";
}

async function repairClassifierDecision(options: {
  llm: LlmClient;
  messages: LlmMessage[];
  rawContent: string;
}) {
  return options.llm.complete({
    messages: [
      ...options.messages,
      { role: "assistant", content: options.rawContent },
      {
        role: "user",
        content:
          'Convert your previous classifier decision to valid compact JSON only. Use exactly this shape: {"shouldRespond":false,"confidence":0,"reason":"short reason"}',
      },
    ],
    temperature: 0,
    maxTokens: CLASSIFIER_MAX_TOKENS,
    enableThinking: false,
  });
}

type ParsedClassifierDecision = {
  decision: ClassifierDecision;
  valid: boolean;
};

export function parseClassifierDecision(
  content: string,
): ParsedClassifierDecision {
  const json = extractJsonObject(content);
  if (!json) {
    return {
      decision: { shouldRespond: false, confidence: 0, reason: "no json" },
      valid: false,
    };
  }

  try {
    const parsed = JSON.parse(json) as Partial<ClassifierDecision>;
    return {
      decision: {
        shouldRespond: parsed.shouldRespond === true,
        confidence: normalizeConfidence(parsed.confidence),
        reason: optionalString(parsed.reason) ?? "no reason",
      },
      valid: true,
    };
  } catch {
    return {
      decision: { shouldRespond: false, confidence: 0, reason: "invalid json" },
      valid: false,
    };
  }
}

function extractJsonObject(content: string): string | undefined {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return undefined;
  return content.slice(start, end + 1);
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
