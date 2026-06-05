import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  PermissionsBitField,
} from "discord.js";
import type { Config } from "../config.js";

type OwnerConfig = Pick<Config, "botOwnerUserIds">;

type DeletePermissionInput = {
  userId: string;
  guildId?: string | null | undefined;
  memberPermissions?: ChatInputCommandInteraction["memberPermissions"];
};

export function isOwner(userId: string, config: OwnerConfig): boolean {
  return config.botOwnerUserIds.has(userId);
}

export function canDeleteBotMessages(
  input: DeletePermissionInput,
  config: OwnerConfig,
): boolean {
  if (isOwner(input.userId, config)) return true;
  if (!input.guildId) return true;
  return Boolean(
    input.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages),
  );
}

export async function requireOwner(
  interaction: ChatInputCommandInteraction,
  config: OwnerConfig,
): Promise<boolean> {
  if (isOwner(interaction.user.id, config)) return true;
  await interaction.reply({ content: "nope, owner-only.", ephemeral: true });
  return false;
}

export async function requireOwnerAutocomplete(
  interaction: AutocompleteInteraction,
  config: OwnerConfig,
): Promise<boolean> {
  if (isOwner(interaction.user.id, config)) return true;
  await interaction.respond([]);
  return false;
}

export async function requireDeleteBotMessagesPermission(
  interaction: ChatInputCommandInteraction,
  config: OwnerConfig,
): Promise<boolean> {
  if (
    canDeleteBotMessages(
      {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        memberPermissions: interaction.memberPermissions,
      },
      config,
    )
  ) {
    return true;
  }

  await interaction.reply({
    content: "nope, you need Manage Messages here.",
    ephemeral: true,
  });
  return false;
}
