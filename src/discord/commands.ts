import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type Message,
  SlashCommandBuilder,
  type TextBasedChannel,
} from "discord.js";
import type { Config } from "../config.js";
import { getBotIdentity } from "../identity.js";
import type { ModelCatalog } from "../llm/model-catalog.js";
import type { Logger } from "../logger.js";
import { reloadPromptFiles } from "../prompts/files.js";
import type { SettingsStore } from "../settings/store.js";

export const DELETE_COMMAND_NAME = "delete";
export const LEAVE_COMMAND_NAME = "leave";
export const MODEL_COMMAND_NAME = "model";
export const RELOAD_COMMAND_NAME = "reload";
const MAX_DELETE_COUNT = 100;

type DeleteResult = {
  scanned: number;
  deleted: number;
  failed: number;
};

export async function registerCommands(
  readyClient: Client<true>,
  logger: Logger,
): Promise<void> {
  const identity = getBotIdentity();
  const deleteCommand = new SlashCommandBuilder()
    .setName(DELETE_COMMAND_NAME)
    .setDescription(`Delete ${identity.name}'s latest messages in this channel`)
    .setDMPermission(true)
    .addIntegerOption((option) =>
      option
        .setName("count")
        .setDescription(
          `How many of ${identity.name}'s latest messages to delete`,
        )
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(MAX_DELETE_COUNT),
    );

  const leaveCommand = new SlashCommandBuilder()
    .setName(LEAVE_COMMAND_NAME)
    .setDescription(`Have ${identity.name} say goodbye and leave this thread`)
    .setDMPermission(false);

  const modelCommand = new SlashCommandBuilder()
    .setName(MODEL_COMMAND_NAME)
    .setDescription(`Show or switch ${identity.name}'s current LLM model`)
    .setDMPermission(true)
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Model alias/name to use, e.g. gemma-4-e4b-it")
        .setRequired(false)
        .setAutocomplete(true),
    );

  const reloadCommand = new SlashCommandBuilder()
    .setName(RELOAD_COMMAND_NAME)
    .setDescription(`Reload ${identity.name}'s prompt and identity files`)
    .setDMPermission(true);

  await readyClient.application.commands.set([
    deleteCommand,
    leaveCommand,
    modelCommand,
    reloadCommand,
  ]);
  await clearGuildCommands(readyClient, logger);
}

async function clearGuildCommands(
  readyClient: Client<true>,
  logger: Logger,
): Promise<void> {
  for (const guild of readyClient.guilds.cache.values()) {
    try {
      await guild.commands.set([]);
      logger.debug({ guildId: guild.id }, "cleared guild slash commands");
    } catch (error) {
      logger.warn(
        { error, guildId: guild.id },
        "failed to clear guild slash commands",
      );
    }
  }
}

export async function handleModelAutocomplete(
  interaction: AutocompleteInteraction,
  options: {
    config: Config;
    logger: Logger;
    modelCatalog: ModelCatalog;
    settings: SettingsStore;
  },
): Promise<void> {
  if (!isOwner(interaction, options.config)) {
    await interaction.respond([]);
    return;
  }

  const focused = interaction.options.getFocused().trim();
  try {
    const models = await options.modelCatalog.getModels();
    await interaction.respond(
      rankModelChoices(models, focused, options.settings.getLlmModel())
        .slice(0, 25)
        .map((model) => ({ name: model, value: model })),
    );
  } catch (error) {
    options.logger.warn({ error }, "failed to autocomplete model choices");
    const currentModel = options.settings.getLlmModel();
    await interaction.respond([{ name: currentModel, value: currentModel }]);
  }
}

export async function handleModelCommand(
  interaction: ChatInputCommandInteraction,
  options: { config: Config; logger: Logger; settings: SettingsStore },
): Promise<void> {
  if (!isOwner(interaction, options.config)) {
    await interaction.reply({ content: "nope, owner-only.", ephemeral: true });
    return;
  }

  const requestedModel = interaction.options.getString("name")?.trim();
  if (!requestedModel) {
    await interaction.reply({
      content: `current model: ${options.settings.getLlmModel()}`,
      ephemeral: true,
    });
    return;
  }

  options.settings.setLlmModel(requestedModel);
  options.logger.info(
    { userId: interaction.user.id, model: requestedModel },
    "switched llm model",
  );

  await interaction.reply({
    content: `model set to ${requestedModel}`,
    ephemeral: true,
  });
}

export async function handleReloadCommand(
  interaction: ChatInputCommandInteraction,
  options: { config: Config; logger: Logger },
): Promise<void> {
  if (!isOwner(interaction, options.config)) {
    await interaction.reply({ content: "nope, owner-only.", ephemeral: true });
    return;
  }

  const cleared = reloadPromptFiles();
  options.logger.info(
    { userId: interaction.user.id, clearedPrompts: cleared },
    "reloaded prompt and identity files",
  );

  await interaction.reply({
    content: `reloaded prompts and identity. cleared ${cleared} cached files.`,
    ephemeral: true,
  });
}

export async function handleDeleteCommand(
  interaction: ChatInputCommandInteraction,
  options: { client: Client; config: Config; logger: Logger },
): Promise<void> {
  const { client, config } = options;
  if (!isOwner(interaction, config)) {
    await interaction.reply({
      content: "nope, owner-only.",
      ephemeral: true,
    });
    return;
  }

  const botUserId = client.user?.id;
  if (!botUserId) throw new Error("Bot user is not ready");

  const count = interaction.options.getInteger("count", true);
  await interaction.deferReply({ ephemeral: true });

  const result = await deleteLatestBotMessages(
    client,
    interaction.channelId,
    botUserId,
    count,
    options.logger,
  );

  await interaction.editReply(
    `deleted ${result.deleted}/${count} latest ${getBotIdentity().name} messages. scanned ${result.scanned}, failed ${result.failed}.`,
  );
}

function rankModelChoices(
  models: string[],
  query: string,
  currentModel: string,
): string[] {
  return [...new Set([currentModel, ...models])]
    .map((model) => ({ model, score: scoreModelChoice(model, query) }))
    .filter((item) => item.score > Number.NEGATIVE_INFINITY)
    .sort(
      (left, right) =>
        right.score - left.score || left.model.localeCompare(right.model),
    )
    .map((item) => item.model);
}

function scoreModelChoice(model: string, query: string): number {
  if (!query) return 0;
  const normalizedModel = model.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  if (normalizedModel === normalizedQuery) return 1000;
  if (normalizedModel.startsWith(normalizedQuery)) return 900 - model.length;
  if (normalizedModel.includes(normalizedQuery)) return 700 - model.length;

  const subsequenceScore = scoreSubsequence(normalizedModel, normalizedQuery);
  return subsequenceScore ?? Number.NEGATIVE_INFINITY;
}

function scoreSubsequence(model: string, query: string): number | undefined {
  let queryIndex = 0;
  let gapCount = 0;

  for (const character of model) {
    if (character === query[queryIndex]) {
      queryIndex += 1;
      if (queryIndex === query.length) return 400 - gapCount;
      continue;
    }

    gapCount += 1;
  }

  return undefined;
}

function isOwner(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction,
  config: Config,
): boolean {
  return config.botOwnerUserIds.has(interaction.user.id);
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
