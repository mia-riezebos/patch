import type {
  ChatInputCommandInteraction,
  Client,
  MessageMentionOptions,
  ThreadChannel,
} from "discord.js";
import type { Config } from "../config.js";
import {
  buildTranscript,
  formatTranscript,
} from "../conversation/transcript.js";
import type { LlmClient } from "../llm/client.js";
import type { Logger } from "../logger.js";
import { buildLeaveMessages } from "../prompts/leave.js";
import type { GenerationQueue } from "../queue.js";
import { toConversationMessage } from "./discord-js-adapter.js";
import { stripUnicodeEmoji } from "./no-emoji.js";
import { splitDiscordResponse } from "./split.js";

const LEAVE_MAX_TOKENS = 96;
const LEAVE_CONTEXT_MESSAGE_LIMIT = 10;
const NO_MENTIONS: MessageMentionOptions = {
  parse: [],
  users: [],
  roles: [],
  repliedUser: false,
};

export async function handleLeaveCommand(
  interaction: ChatInputCommandInteraction,
  options: {
    client: Client;
    config: Config;
    llm: LlmClient;
    logger: Logger;
    queue: GenerationQueue;
  },
): Promise<void> {
  await interaction.deferReply();

  const botUserId = options.client.user?.id;
  if (!botUserId) throw new Error("Bot user is not ready");

  const channel = await options.client.channels.fetch(interaction.channelId);
  if (!channel?.isThread()) {
    await interaction.editReply("/leave only works in threads.");
    return;
  }

  await options.queue.add(
    () =>
      leaveThread(interaction, channel, {
        ...options,
        botUserId,
      }),
    {
      priority: "leave",
      bucketKey: channel.id,
    },
  );
}

async function leaveThread(
  interaction: ChatInputCommandInteraction,
  thread: ThreadChannel,
  options: {
    config: Config;
    llm: LlmClient;
    logger: Logger;
    botUserId: string;
  },
): Promise<void> {
  const log = options.logger.child({
    channelId: thread.id,
    guildId: thread.guildId,
    operation: "leave-thread",
  });

  try {
    const transcript = await buildLeaveTranscript(
      thread,
      options.botUserId,
      interaction.createdTimestamp,
      log,
      options.config.threadContextMessageLimit,
    );
    const farewell = await generateFarewell({
      ...options,
      transcript,
      requester: {
        id: interaction.user.id,
        name: interaction.user.globalName ?? interaction.user.username,
      },
    });

    await sendFarewell(interaction, thread, farewell, log);
    await thread.leave();
  } catch (error) {
    log.error({ error }, "failed to leave thread");
    await interaction.editReply("couldn't leave cleanly. staying put.");
  }
}

async function sendFarewell(
  interaction: ChatInputCommandInteraction,
  thread: ThreadChannel,
  farewell: string,
  log: Logger,
): Promise<void> {
  const [first, ...rest] = splitDiscordResponse(farewell);
  if (!first) throw new Error("leave farewell split into no chunks");

  log.debug({ chunkCount: rest.length + 1 }, "sending leave farewell chunks");
  await interaction.editReply({
    content: first,
    allowedMentions: NO_MENTIONS,
  });

  for (const [offset, chunk] of rest.entries()) {
    const index = offset + 1;
    log.debug(
      { index, chunkLength: chunk.length },
      "sending leave follow-up chunk",
    );
    await thread.send({
      content: chunk,
      allowedMentions: NO_MENTIONS,
    });
  }
}

async function buildLeaveTranscript(
  thread: ThreadChannel,
  botUserId: string,
  beforeTimestamp: number,
  log: Logger,
  configuredLimit: number,
): Promise<string> {
  const limit = Math.min(LEAVE_CONTEXT_MESSAGE_LIMIT, configuredLimit);

  try {
    const fetched = await thread.messages.fetch({ limit });
    const messages = [...fetched.values()]
      .filter((message) => message.createdTimestamp <= beforeTimestamp)
      .sort((left, right) => {
        const timestampDelta = left.createdTimestamp - right.createdTimestamp;
        if (timestampDelta !== 0) return timestampDelta;
        return left.id.localeCompare(right.id);
      })
      .map((message) => ({
        ...toConversationMessage(message, botUserId),
        context: "thread" as const,
      }));

    const transcript = formatTranscript(buildTranscript(messages, botUserId));
    log.debug(
      { messageCount: messages.length, transcript },
      "built leave transcript",
    );
    return transcript || "(no recent thread messages)";
  } catch (error) {
    log.warn({ error }, "failed to build leave transcript");
    return "(recent thread messages unavailable)";
  }
}

async function generateFarewell(options: {
  config: Config;
  llm: LlmClient;
  logger: Logger;
  transcript: string;
  requester: { id: string; name: string };
}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.config.llmTimeoutMs,
  );

  try {
    const response = await options.llm.complete({
      messages: buildLeaveMessages(options.requester, options.transcript),
      maxTokens: LEAVE_MAX_TOKENS,
      enableThinking: false,
      signal: controller.signal,
    });
    const content = stripUnicodeEmoji(response.content.trim());
    if (!content) {
      throw new Error(
        `LLM returned empty leave farewell; finishReason=${response.finishReason ?? "unknown"}; reasoningContentLength=${response.reasoningContent?.length ?? 0}`,
      );
    }

    options.logger.debug(
      { finishReason: response.finishReason, timings: response.timings },
      "generated leave farewell",
    );
    return content;
  } finally {
    clearTimeout(timeout);
  }
}
