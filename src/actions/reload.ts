import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { Schema } from "effect";
import { getBotIdentity } from "../identity.js";
import { reloadPromptFiles } from "../prompts/files.js";
import type { Action, ActionInvocation } from "./context.js";
import { requireOwner } from "./permissions.js";

const RELOAD_COMMAND_NAME = "reload";

export const reloadRuntimeAction: Action = {
  name: "reload_runtime",
  description: "Reload prompt and identity files.",
  inputSchema: Schema.Struct({}),
  ownerOnly: true,
  triggers: [
    {
      kind: "slash_command",
      name: RELOAD_COMMAND_NAME,
      description: `Reload ${getBotIdentity().name}'s prompt and identity files`,
      usage: "/reload",
      data: new SlashCommandBuilder()
        .setName(RELOAD_COMMAND_NAME)
        .setDescription(
          `Reload ${getBotIdentity().name}'s prompt and identity files`,
        )
        .setDMPermission(true),
      parse: () => ({}),
    },
  ],
  availability: () => ({ available: true }),
  async execute(invocation, context) {
    const interaction = requireSlashInteraction(invocation);
    if (!(await requireOwner(interaction, context.config))) {
      return { kind: "handled" };
    }

    const cleared = reloadPromptFiles();
    context.logger.info(
      { userId: interaction.user.id, clearedPrompts: cleared },
      "reloaded prompt and identity files",
    );

    await interaction.reply({
      content: `reloaded prompts and identity. cleared ${cleared} cached files.`,
      ephemeral: true,
    });
    return { kind: "handled" };
  },
};

function requireSlashInteraction(
  invocation: ActionInvocation,
): ChatInputCommandInteraction {
  if (!isChatInputCommandInteraction(invocation.interaction)) {
    throw new Error("reload_runtime requires a slash command interaction");
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
