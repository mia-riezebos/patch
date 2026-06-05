import {
  type ChatInputCommandInteraction,
  type Client,
  type Message,
  SlashCommandBuilder,
  type TextBasedChannel,
} from "discord.js";
import { Schema } from "effect";
import { getBotIdentity } from "../identity.js";
import type { Logger } from "../logger.js";
import type { Action, ActionInvocation } from "./context.js";
import { requireDeleteBotMessagesPermission } from "./permissions.js";

const DELETE_COMMAND_NAME = "delete";
const MAX_DELETE_COUNT = 100;

type DeleteArgs = {
  count: number;
};

type DeleteResult = {
  scanned: number;
  deleted: number;
  failed: number;
};

export const deleteMessagesAction: Action = {
  name: "delete_messages",
  description: "Delete the bot's latest messages in the current channel.",
  inputSchema: Schema.Struct({ count: Schema.Number }),
  triggers: [
    {
      kind: "slash_command",
      name: DELETE_COMMAND_NAME,
      description: `Delete ${getBotIdentity().name}'s latest messages in this channel`,
      usage: "/delete count:<1-100>",
      data: new SlashCommandBuilder()
        .setName(DELETE_COMMAND_NAME)
        .setDescription(
          `Delete ${getBotIdentity().name}'s latest messages in this channel`,
        )
        .setDMPermission(true)
        .addIntegerOption((option) =>
          option
            .setName("count")
            .setDescription(
              `How many of ${getBotIdentity().name}'s latest messages to delete`,
            )
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(MAX_DELETE_COUNT),
        ),
      parse: (interaction: ChatInputCommandInteraction) => ({
        count: interaction.options.getInteger("count", true),
      }),
    },
  ],
  availability: () => ({ available: true }),
  async execute(invocation, context) {
    const interaction = requireSlashInteraction(invocation);
    if (
      !(await requireDeleteBotMessagesPermission(interaction, context.config))
    ) {
      return { kind: "handled" };
    }

    const botUserId = context.client.user?.id;
    if (!botUserId) throw new Error("Bot user is not ready");

    const { count } = invocation.args as DeleteArgs;
    await interaction.deferReply({ ephemeral: true });

    const result = await deleteLatestBotMessages(
      context.client,
      interaction.channelId,
      botUserId,
      count,
      context.logger,
    );

    await interaction.editReply(
      `deleted ${result.deleted}/${count} latest ${getBotIdentity().name} messages. scanned ${result.scanned}, failed ${result.failed}.`,
    );
    return { kind: "handled" };
  },
};

function requireSlashInteraction(
  invocation: ActionInvocation,
): ChatInputCommandInteraction {
  if (!isChatInputCommandInteraction(invocation.interaction)) {
    throw new Error("delete_messages requires a slash command interaction");
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

async function deleteLatestBotMessages(
  client: Client,
  channelId: string,
  botUserId: string,
  count: number,
  logger: Logger,
): Promise<DeleteResult> {
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased()) {
    throw new Error(`Channel ${channelId} is not text based`);
  }

  const { messages, scanned } = await collectLatestBotMessages(
    channel,
    botUserId,
    count,
  );
  const result = await deleteMessagesIndividually(messages, logger);
  return { scanned, deleted: result.deleted, failed: result.failed };
}

async function collectLatestBotMessages(
  channel: TextBasedChannel,
  botUserId: string,
  count: number,
): Promise<{ messages: Message[]; scanned: number }> {
  const botMessages: Message[] = [];
  let before: string | undefined;
  let scanned = 0;

  while (botMessages.length < count) {
    const messages = await fetchMessages(channel, before);
    if (messages.length === 0) break;

    scanned += messages.length;
    before = messages.at(-1)?.id;

    for (const message of messages) {
      if (message.author.id === botUserId) botMessages.push(message);
      if (botMessages.length >= count) break;
    }

    if (messages.length < 100) break;
  }

  return { messages: botMessages, scanned };
}

async function deleteMessagesIndividually(
  messages: Message[],
  logger: Logger,
): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;

  for (const message of messages) {
    try {
      await message.delete();
      deleted += 1;
    } catch (error) {
      failed += 1;
      logger.warn(
        { error, messageId: message.id },
        "failed to delete bot message",
      );
    }
  }

  return { deleted, failed };
}

async function fetchMessages(
  channel: TextBasedChannel,
  before: string | undefined,
): Promise<Message[]> {
  const options: { limit: 100; before?: string } = { limit: 100 };
  if (before) options.before = before;
  const messages = await channel.messages.fetch(options);
  return [...messages.values()];
}
