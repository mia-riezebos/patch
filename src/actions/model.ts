import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { Schema } from "effect";
import { getBotIdentity } from "../identity.js";
import type { Action, ActionContext, ActionInvocation } from "./context.js";
import { requireOwner, requireOwnerAutocomplete } from "./permissions.js";

const MODEL_COMMAND_NAME = "model";

type ModelArgs = {
  name?: string;
};

export const modelAction: Action = {
  name: "model",
  description: "Show or switch the current LLM model.",
  inputSchema: Schema.Struct({ name: Schema.optional(Schema.String) }),
  ownerOnly: true,
  triggers: [
    {
      kind: "slash_command",
      name: MODEL_COMMAND_NAME,
      description: `Show or switch ${getBotIdentity().name}'s current LLM model`,
      usage: "/model [name:<model alias>]",
      data: new SlashCommandBuilder()
        .setName(MODEL_COMMAND_NAME)
        .setDescription(
          `Show or switch ${getBotIdentity().name}'s current LLM model`,
        )
        .setDMPermission(true)
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Model alias/name to use, e.g. gemma-4-e4b-it")
            .setRequired(false)
            .setAutocomplete(true),
        ),
      parse: (interaction: ChatInputCommandInteraction) => ({
        name: interaction.options.getString("name")?.trim() || undefined,
      }),
      autocomplete: handleModelAutocomplete,
    },
  ],
  availability: () => ({ available: true }),
  async execute(invocation, context) {
    const interaction = requireSlashInteraction(invocation);
    if (!(await requireOwner(interaction, context.config))) {
      return { kind: "handled" };
    }

    const { name } = invocation.args as ModelArgs;
    if (!name) {
      await interaction.reply({
        content: `current model: ${context.settings.getLlmModel()}`,
        ephemeral: true,
      });
      return { kind: "handled" };
    }

    context.settings.setLlmModel(name);
    context.logger.info(
      { userId: interaction.user.id, model: name },
      "switched llm model",
    );

    await interaction.reply({
      content: `model set to ${name}`,
      ephemeral: true,
    });
    return { kind: "handled" };
  },
};

async function handleModelAutocomplete(
  interaction: AutocompleteInteraction,
  context: ActionContext,
): Promise<void> {
  if (!(await requireOwnerAutocomplete(interaction, context.config))) return;

  const focused = interaction.options.getFocused().trim();
  try {
    const models = await context.modelCatalog.getModels();
    await interaction.respond(
      rankModelChoices(models, focused, context.settings.getLlmModel())
        .slice(0, 25)
        .map((model) => ({ name: model, value: model })),
    );
  } catch (error) {
    context.logger.warn({ error }, "failed to autocomplete model choices");
    const currentModel = context.settings.getLlmModel();
    await interaction.respond([{ name: currentModel, value: currentModel }]);
  }
}

function requireSlashInteraction(
  invocation: ActionInvocation,
): ChatInputCommandInteraction {
  if (!isChatInputCommandInteraction(invocation.interaction)) {
    throw new Error("model requires a slash command interaction");
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
