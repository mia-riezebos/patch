import {
  type ChatInputCommandInteraction,
  type Message,
  type MessageMentionOptions,
  SlashCommandBuilder,
  type ThreadChannel,
} from "discord.js";
import { Schema } from "effect";
import {
  buildTranscript,
  formatTranscript,
} from "../conversation/transcript.js";
import { toConversationMessage } from "../discord/discord-js-adapter.js";
import { stripUnicodeEmoji } from "../discord/no-emoji.js";
import { splitDiscordResponse } from "../discord/split.js";
import { getBotIdentity } from "../identity.js";
import { askLlm } from "../llm/ask.js";
import type { LlmResponse } from "../llm/client.js";
import type { Logger } from "../logger.js";
import { buildLeaveMessages } from "../prompts/leave.js";
import type { Action, ActionContext, ActionInvocation } from "./context.js";

const LEAVE_COMMAND_NAME = "leave";
const LEAVE_MAX_TOKENS = 96;
const LEAVE_CONTEXT_MESSAGE_LIMIT = 10;
const NO_MENTIONS: MessageMentionOptions = {
  parse: [],
  users: [],
  roles: [],
  repliedUser: false,
};

type LeaveThreadArgs = {
  farewell: string;
};

const LeaveThreadArgsSchema = Schema.Struct({
  farewell: Schema.String,
});

export const leaveThreadAction: Action = {
  name: "leave_thread",
  description: "Say goodbye and leave the current thread.",
  inputSchema: LeaveThreadArgsSchema,
  triggers: [
    {
      kind: "slash_command",
      name: LEAVE_COMMAND_NAME,
      description: `Have ${getBotIdentity().name} say goodbye and leave this thread`,
      usage: "/leave",
      data: new SlashCommandBuilder()
        .setName(LEAVE_COMMAND_NAME)
        .setDescription(
          `Have ${getBotIdentity().name} say goodbye and leave this thread`,
        )
        .setDMPermission(false),
      parse: () => ({}),
    },
    {
      kind: "tool_call",
      name: "leave_thread",
      description: "Send a farewell message, then leave the current thread.",
      usage:
        "Use when the latest user asks Patch to leave, exit, go away, stop participating, or otherwise remove herself from the current thread. Put the exact Discord-visible farewell in farewell.",
      inputSchema: LeaveThreadArgsSchema,
      inputSchemaJson: {
        type: "object",
        additionalProperties: false,
        properties: {
          farewell: {
            type: "string",
            description:
              "Exact Discord-visible farewell to send before leaving. May include <split /> for multiple Discord messages.",
          },
        },
        required: ["farewell"],
      },
    },
  ],
  availability(input) {
    if (!input.isThread) {
      return { available: false, reason: "only available in threads" };
    }
    return { available: true };
  },
  async execute(invocation, context) {
    const botUserId = context.client.user?.id;
    if (!botUserId) throw new Error("Bot user is not ready");

    const channel = await context.client.channels.fetch(invocation.channelId);
    if (!channel?.isThread()) {
      return {
        kind: "not_applicable",
        reason: "leave_thread only works in threads",
      };
    }

    if (invocation.source === "slash_command") {
      const interaction = requireSlashInteraction(invocation);
      await interaction.deferReply();
      await context.queue.add(
        () => runSlashLeave(channel, { ...context, invocation, botUserId }),
        { priority: "leave", bucketKey: channel.id },
      );
      return { kind: "handled" };
    }

    await leaveThread(channel, { ...context, invocation, botUserId });
    return { kind: "handled" };
  },
};

function requireSlashInteraction(
  invocation: ActionInvocation,
): ChatInputCommandInteraction {
  if (!isChatInputCommandInteraction(invocation.interaction)) {
    throw new Error("leave_thread slash trigger requires a slash interaction");
  }
  return invocation.interaction;
}

function isChatInputCommandInteraction(
  interaction: unknown,
): interaction is ChatInputCommandInteraction {
  return Boolean(
    interaction &&
      typeof interaction === "object" &&
      "isChatInputCommand" in interaction &&
      typeof interaction.isChatInputCommand === "function" &&
      interaction.isChatInputCommand(),
  );
}

function isDiscordMessage(message: unknown): message is Message {
  return Boolean(
    message &&
      typeof message === "object" &&
      "createdTimestamp" in message &&
      typeof message.createdTimestamp === "number",
  );
}

async function runSlashLeave(
  thread: ThreadChannel,
  options: ActionContext & { invocation: ActionInvocation; botUserId: string },
): Promise<void> {
  try {
    const farewell = await generateSlashFarewell(thread, options);
    await leaveThread(thread, {
      ...options,
      invocation: { ...options.invocation, args: { farewell } },
    });
  } catch (error) {
    options.logger.error(
      { error, threadId: thread.id },
      "failed to leave thread",
    );
    const interaction = options.invocation.interaction;
    if (isChatInputCommandInteraction(interaction)) {
      await interaction.editReply("couldn't leave cleanly. staying put.");
    }
  }
}

async function generateSlashFarewell(
  thread: ThreadChannel,
  options: ActionContext & { invocation: ActionInvocation; botUserId: string },
): Promise<string> {
  const log = options.logger.child({
    channelId: thread.id,
    guildId: thread.guildId,
    operation: "leave-thread-farewell",
  });
  const transcript = await buildLeaveTranscript(
    thread,
    options.botUserId,
    cutoffTimestamp(options.invocation),
    log,
    options.config.threadContextMessageLimit,
  );
  return generateFarewell({
    ...options,
    transcript,
    requester: options.invocation.requester ?? {
      id: "unknown",
      name: "someone",
    },
  });
}

async function leaveThread(
  thread: ThreadChannel,
  options: ActionContext & { invocation: ActionInvocation; botUserId: string },
): Promise<void> {
  const log = options.logger.child({
    channelId: thread.id,
    guildId: thread.guildId,
    operation: "leave-thread",
  });

  try {
    const { farewell } = parseLeaveThreadArgs(options.invocation.args);
    await sendFarewell(
      options.invocation,
      thread,
      sanitizeFarewell(farewell),
      log,
    );
    await thread.leave();
  } catch (error) {
    log.error({ error }, "failed to leave thread");
    const interaction = options.invocation.interaction;
    if (isChatInputCommandInteraction(interaction)) {
      await interaction.editReply("couldn't leave cleanly. staying put.");
    }
  }
}

function cutoffTimestamp(invocation: ActionInvocation): number {
  if (isChatInputCommandInteraction(invocation.interaction)) {
    return invocation.interaction.createdTimestamp;
  }
  if (isDiscordMessage(invocation.triggerMessage)) {
    return invocation.triggerMessage.createdTimestamp;
  }
  return Date.now();
}

function parseLeaveThreadArgs(args: unknown): LeaveThreadArgs {
  if (!args || typeof args !== "object" || !("farewell" in args)) {
    throw new Error("leave_thread requires a farewell argument");
  }

  const farewell = (args as { farewell: unknown }).farewell;
  if (typeof farewell !== "string") {
    throw new Error("leave_thread farewell must be a string");
  }

  return { farewell };
}

function sanitizeFarewell(farewell: string): string {
  const sanitized = stripUnicodeEmoji(farewell.trim());
  if (!sanitized) throw new Error("leave_thread farewell cannot be empty");
  return sanitized;
}

async function sendFarewell(
  invocation: ActionInvocation,
  thread: ThreadChannel,
  farewell: string,
  log: Logger,
): Promise<void> {
  const [first, ...rest] = splitDiscordResponse(farewell);
  if (!first) throw new Error("leave farewell split into no chunks");

  log.debug({ chunkCount: rest.length + 1 }, "sending leave farewell chunks");
  const interaction = invocation.interaction;
  if (isChatInputCommandInteraction(interaction)) {
    await interaction.editReply({
      content: first,
      allowedMentions: NO_MENTIONS,
    });
  } else {
    await thread.send({ content: first, allowedMentions: NO_MENTIONS });
  }

  for (const [offset, chunk] of rest.entries()) {
    const index = offset + 1;
    log.debug(
      { index, chunkLength: chunk.length },
      "sending leave follow-up chunk",
    );
    await thread.send({ content: chunk, allowedMentions: NO_MENTIONS });
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
  config: ActionContext["config"];
  llm: ActionContext["llm"];
  logger: ActionContext["logger"];
  transcript: string;
  requester: { id: string; name: string };
}): Promise<string> {
  return askLlm({
    llm: options.llm,
    logger: options.logger,
    label: "leave-thread-farewell",
    messages: buildLeaveMessages(options.requester, options.transcript),
    maxTokens: LEAVE_MAX_TOKENS,
    enableThinking: false,
    timeoutMs: options.config.llmTimeoutMs,
    parse: parseFarewellResponse,
  });
}

function parseFarewellResponse(response: LlmResponse): string {
  const content = stripUnicodeEmoji(response.content.trim());
  if (!content) {
    throw new Error(
      `LLM returned empty leave farewell; finishReason=${response.finishReason ?? "unknown"}; reasoningContentLength=${response.reasoningContent?.length ?? 0}`,
    );
  }
  return content;
}
