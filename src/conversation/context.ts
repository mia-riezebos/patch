import type { Message } from "discord.js";
import type { DiscordAdapter } from "../discord/adapter.js";
import { toConversationMessage } from "../discord/discord-js-adapter.js";
import type { PronounProvider } from "../discord/pronouns.js";
import type { Logger } from "../logger.js";
import { reconstructReplyChain } from "./reply-chain.js";
import type { ConversationMessage, TranscriptContext } from "./types.js";

const DEFAULT_DM_CONTEXT_MESSAGE_LIMIT = 30;
const DEFAULT_THREAD_CONTEXT_MESSAGE_LIMIT = 30;
const DEFAULT_GUILD_RECENT_MESSAGE_LIMIT = 10;
const PROMPT_OVERHEAD_TOKENS = 3_000;
const TRANSCRIPT_METADATA_CHARS_PER_MESSAGE = 450;
const DISCORD_MESSAGE_CONTENT_CHAR_LIMIT = 4_000;

export type ContextBudget = {
  contextTokens: number;
};

export type ConversationContextOptions = {
  dmContextMessageLimit?: number;
  threadContextMessageLimit?: number;
  guildRecentMessageLimit?: number;
};

export async function reconstructConversationContext(
  adapter: DiscordAdapter,
  message: Message,
  botUserId: string,
  log: Logger,
  pronounProvider?: PronounProvider,
  options: ConversationContextOptions = {},
): Promise<ConversationMessage[]> {
  const trigger = toConversationMessage(message, botUserId);
  if (!message.inGuild()) {
    const recent = await fetchDmContext(
      message,
      botUserId,
      log,
      options.dmContextMessageLimit ?? DEFAULT_DM_CONTEXT_MESSAGE_LIMIT,
    );
    const botReplyChain = await fetchBotReplyChain(
      adapter,
      trigger,
      botUserId,
      log,
    );

    return addAuthorPronouns(
      canonicalizeContextMessages([...recent, ...botReplyChain], trigger.id),
      pronounProvider,
    );
  }

  if (message.channel.isThread()) {
    const recent = withContext(
      await fetchThreadContext(
        message,
        botUserId,
        log,
        options.threadContextMessageLimit ??
          DEFAULT_THREAD_CONTEXT_MESSAGE_LIMIT,
      ),
      "thread",
    );
    const botReplyChain = withContext(
      await fetchBotReplyChain(adapter, trigger, botUserId, log),
      "thread",
    );

    return addAuthorPronouns(
      canonicalizeContextMessages([...recent, ...botReplyChain], trigger.id),
      pronounProvider,
      message.guildId,
    );
  }

  const replyChain = message.reference?.messageId
    ? await reconstructReplyChain(adapter, trigger, log)
    : [trigger];
  const recent = await fetchGuildRecentContext(
    message,
    botUserId,
    log,
    options.guildRecentMessageLimit ?? DEFAULT_GUILD_RECENT_MESSAGE_LIMIT,
  );

  return addAuthorPronouns(
    canonicalizeContextMessages(
      [
        ...withContext(recent, "neighbor"),
        ...withContext(replyChain, "reply_chain"),
      ],
      trigger.id,
    ),
    pronounProvider,
    message.guildId,
  );
}

export function limitContextMessages(
  messages: ConversationMessage[],
  limit: number,
): ConversationMessage[] {
  if (messages.length <= limit) return messages;
  return messages.slice(-limit);
}

export function trimConversationContext(
  messages: ConversationMessage[],
  budget: ContextBudget,
): ConversationMessage[] {
  const availableTokens = Math.max(
    512,
    budget.contextTokens - PROMPT_OVERHEAD_TOKENS,
  );

  let trimmed = [...messages];
  let nextTrimLane: TrimLane = "neighbor";
  const protectedIds = findProtectedContextIds(messages);

  while (
    estimateContextTokens(trimmed) > availableTokens &&
    trimmed.length > 1
  ) {
    const preferred = removeFirstInLane(trimmed, nextTrimLane, protectedIds);
    if (preferred) {
      trimmed = preferred;
      nextTrimLane = oppositeTrimLane(nextTrimLane);
      continue;
    }

    const fallbackLane = oppositeTrimLane(nextTrimLane);
    const fallback = removeFirstInLane(trimmed, fallbackLane, protectedIds);
    if (!fallback) break;

    trimmed = fallback;
  }

  return trimmed;
}

type TrimLane = "neighbor" | "core";

function removeFirstInLane(
  messages: ConversationMessage[],
  lane: TrimLane,
  protectedIds: ReadonlySet<string>,
): ConversationMessage[] | undefined {
  const removableIndex = messages.findIndex(
    (message, index) =>
      index < messages.length - 1 &&
      !protectedIds.has(message.id) &&
      isInTrimLane(message, lane),
  );

  return removableIndex === -1
    ? undefined
    : messages.toSpliced(removableIndex, 1);
}

function findProtectedContextIds(messages: ConversationMessage[]): Set<string> {
  const protectedIds = new Set<string>();
  const messagesById = new Map(
    messages.map((message) => [message.id, message]),
  );
  let current = messages.at(-1);

  while (current?.replyTo) {
    const parent = messagesById.get(current.replyTo.messageId);
    if (!parent || protectedIds.has(parent.id)) break;
    protectedIds.add(parent.id);
    current = parent;
  }

  return protectedIds;
}

function isInTrimLane(message: ConversationMessage, lane: TrimLane): boolean {
  if (lane === "neighbor") return message.context === "neighbor";
  return message.context !== "neighbor";
}

function oppositeTrimLane(lane: TrimLane): TrimLane {
  return lane === "neighbor" ? "core" : "neighbor";
}

export function summarizeContext(messages: ConversationMessage[]) {
  return messages.map((message, index) => ({
    index,
    id: message.id,
    authorId: message.authorId,
    authorName: message.authorName,
    authorPronouns: message.authorPronouns,
    authorIsBot: message.authorIsBot,
    channelId: message.channelId,
    threadId: message.threadId,
    replyTo: message.replyTo,
    context: message.context,
    timestamp: message.timestamp.toISOString(),
    content: message.content,
  }));
}

function estimateContextTokens(messages: ConversationMessage[]): number {
  const chars = messages.reduce((total, message) => {
    const metadataBudget = TRANSCRIPT_METADATA_CHARS_PER_MESSAGE;
    return (
      total +
      Math.min(message.content.length, DISCORD_MESSAGE_CONTENT_CHAR_LIMIT) +
      message.authorName.length +
      (message.authorPronouns?.length ?? 0) +
      metadataBudget
    );
  }, 0);

  return Math.ceil(chars / 4);
}

async function fetchThreadContext(
  message: Message,
  botUserId: string,
  log: Logger,
  limit: number,
): Promise<ConversationMessage[]> {
  try {
    const fetched = await message.channel.messages.fetch({
      limit,
    });
    const messagesById = new Map<string, Message>(
      fetched.map((item) => [item.id, item]),
    );
    messagesById.set(message.id, message);

    return [...messagesById.values()]
      .filter((item) => item.createdTimestamp <= message.createdTimestamp)
      .sort((left, right) => left.createdTimestamp - right.createdTimestamp)
      .map((item) => toConversationMessage(item, botUserId));
  } catch (error) {
    log.warn({ error }, "failed to fetch thread context");
    return [toConversationMessage(message, botUserId)];
  }
}

async function fetchGuildRecentContext(
  message: Message,
  botUserId: string,
  log: Logger,
  limit: number,
): Promise<ConversationMessage[]> {
  try {
    const fetched = await message.channel.messages.fetch({ limit });
    const messagesById = new Map<string, Message>(
      fetched.map((item) => [item.id, item]),
    );
    messagesById.set(message.id, message);

    return [...messagesById.values()]
      .filter((item) => item.createdTimestamp <= message.createdTimestamp)
      .sort((left, right) => left.createdTimestamp - right.createdTimestamp)
      .map((item) => toConversationMessage(item, botUserId));
  } catch (error) {
    log.warn({ error }, "failed to fetch guild recent context");
    return [toConversationMessage(message, botUserId)];
  }
}

async function fetchBotReplyChain(
  adapter: DiscordAdapter,
  trigger: ConversationMessage,
  botUserId: string,
  log: Logger,
): Promise<ConversationMessage[]> {
  if (!trigger.replyTo) return [];

  const chain = await reconstructReplyChain(adapter, trigger, log);
  const parent = chain.at(-2);
  return parent?.authorId === botUserId ? chain : [];
}

function withContext(
  messages: ConversationMessage[],
  context: TranscriptContext,
): ConversationMessage[] {
  return messages.map((message) => ({ ...message, context }));
}

export function canonicalizeContextMessages(
  messages: ConversationMessage[],
  triggerMessageId?: string,
): ConversationMessage[] {
  const messagesById = new Map<string, ConversationMessage>();

  for (const message of messages) {
    const existing = messagesById.get(message.id);
    messagesById.set(
      message.id,
      mergeDuplicateContextMessage(existing, message),
    );
  }

  const sorted = [...messagesById.values()].sort(compareContextMessages);
  if (!triggerMessageId) return sorted;

  const triggerIndex = sorted.findIndex(
    (message) => message.id === triggerMessageId,
  );
  if (triggerIndex === -1) return sorted;

  const [trigger] = sorted.splice(triggerIndex, 1);
  if (trigger) sorted.push(trigger);
  return sorted;
}

function mergeDuplicateContextMessage(
  existing: ConversationMessage | undefined,
  next: ConversationMessage,
): ConversationMessage {
  if (!existing) return next;
  if (existing.context === "reply_chain") return existing;
  if (next.context === "reply_chain") return next;
  return existing;
}

function compareContextMessages(
  left: ConversationMessage,
  right: ConversationMessage,
): number {
  const timestampDelta = left.timestamp.getTime() - right.timestamp.getTime();
  if (timestampDelta !== 0) return timestampDelta;
  return left.id.localeCompare(right.id);
}

async function addAuthorPronouns(
  messages: ConversationMessage[],
  pronounProvider: PronounProvider | undefined,
  guildId?: string,
): Promise<ConversationMessage[]> {
  if (!pronounProvider) return messages;

  const pronounsByAuthor = new Map<string, string>();
  await Promise.all(
    [...new Set(messages.map((message) => message.authorId))]
      .filter(
        (authorId) =>
          !messages.some(
            (message) => message.authorId === authorId && message.authorIsBot,
          ),
      )
      .map(async (authorId) => {
        const pronouns = await pronounProvider.getPronouns(authorId, guildId);
        if (pronouns) pronounsByAuthor.set(authorId, pronouns);
      }),
  );

  return messages.map((message) => {
    const authorPronouns = pronounsByAuthor.get(message.authorId);
    return authorPronouns ? { ...message, authorPronouns } : message;
  });
}

async function fetchDmContext(
  message: Message,
  botUserId: string,
  log: Logger,
  limit: number,
) {
  try {
    const fetched = await message.channel.messages.fetch({
      limit,
    });
    const messagesById = new Map<string, Message>(
      fetched.map((item) => [item.id, item]),
    );
    messagesById.set(message.id, message);

    return [...messagesById.values()]
      .filter((item) => item.createdTimestamp <= message.createdTimestamp)
      .sort((left, right) => left.createdTimestamp - right.createdTimestamp)
      .map((item) => toConversationMessage(item, botUserId));
  } catch (error) {
    log.warn({ error }, "failed to fetch DM context");
    return [toConversationMessage(message, botUserId)];
  }
}
