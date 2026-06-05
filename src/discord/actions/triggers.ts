import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  Interaction,
  MessageContextMenuCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import type {
  Action,
  ActionContext,
  ActionTriggerBase,
} from "../../actions/context.js";
import type { ActionRegistry } from "../../actions/registry.js";

export interface SlashCommandTrigger extends ActionTriggerBase {
  kind: "slash_command";
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  parse(interaction: ChatInputCommandInteraction): unknown;
  autocomplete?(
    interaction: AutocompleteInteraction,
    context: ActionContext,
  ): Promise<void>;
}

export interface MessageContextMenuTrigger extends ActionTriggerBase {
  kind: "message_context_menu";
  data: ContextMenuCommandBuilder;
  parse(interaction: MessageContextMenuCommandInteraction): unknown;
}

export type DiscordActionTrigger =
  | SlashCommandTrigger
  | MessageContextMenuTrigger;

export type ResolvedDiscordTrigger = {
  action: Action;
  trigger: DiscordActionTrigger;
};

export function isActionInteraction(
  interaction: Interaction,
): interaction is
  | ChatInputCommandInteraction
  | MessageContextMenuCommandInteraction {
  return (
    interaction.isChatInputCommand() ||
    interaction.isMessageContextMenuCommand()
  );
}

export function isSlashCommandTrigger(
  trigger: ActionTriggerBase,
): trigger is SlashCommandTrigger {
  return trigger.kind === "slash_command";
}

export function isMessageContextMenuTrigger(
  trigger: ActionTriggerBase,
): trigger is MessageContextMenuTrigger {
  return trigger.kind === "message_context_menu";
}

export function isDiscordActionTrigger(
  trigger: ActionTriggerBase,
): trigger is DiscordActionTrigger {
  return isSlashCommandTrigger(trigger) || isMessageContextMenuTrigger(trigger);
}

export function getDiscordTriggers(
  registry: ActionRegistry,
): ResolvedDiscordTrigger[] {
  const triggers = registry.actions.flatMap((action) =>
    action.triggers
      .filter(isDiscordActionTrigger)
      .map((trigger) => ({ action, trigger })),
  );
  assertUniqueDiscordTriggers(triggers);
  return triggers;
}

export function getDiscordTrigger(
  registry: ActionRegistry,
  commandName: string,
): ResolvedDiscordTrigger | undefined {
  return getDiscordTriggers(registry).find(
    (entry) => entry.trigger.name === commandName,
  );
}

export function getAutocompleteTrigger(
  registry: ActionRegistry,
  commandName: string,
): SlashCommandTrigger | undefined {
  return getDiscordTriggers(registry)
    .map((entry) => entry.trigger)
    .filter(isSlashCommandTrigger)
    .find((trigger) => trigger.name === commandName && trigger.autocomplete);
}

function assertUniqueDiscordTriggers(triggers: ResolvedDiscordTrigger[]): void {
  const seen = new Map<string, ResolvedDiscordTrigger>();
  for (const entry of triggers) {
    const existing = seen.get(entry.trigger.name);
    if (existing) {
      throw new Error(
        `Duplicate Discord trigger name: ${entry.trigger.name} (${existing.action.name}, ${entry.action.name})`,
      );
    }
    seen.set(entry.trigger.name, entry);
  }
}
