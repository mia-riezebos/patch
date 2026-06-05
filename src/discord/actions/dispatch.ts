import type {
  ChatInputCommandInteraction,
  Interaction,
  MessageContextMenuCommandInteraction,
} from "discord.js";
import type { ActionContext, ActionInvocation } from "../../actions/context.js";
import type { ActionRegistry } from "../../actions/registry.js";
import {
  type ResolvedDiscordTrigger,
  getAutocompleteTrigger,
  getDiscordTrigger,
} from "./triggers.js";

export async function dispatchInteraction(input: {
  interaction: Interaction;
  context: ActionContext;
  registry: ActionRegistry;
}): Promise<void> {
  const { interaction, context, registry } = input;

  if (interaction.isAutocomplete()) {
    const trigger = getAutocompleteTrigger(registry, interaction.commandName);
    if (!trigger?.autocomplete) return;
    await trigger.autocomplete(interaction, context);
    return;
  }

  if (
    !interaction.isChatInputCommand() &&
    !interaction.isMessageContextMenuCommand()
  ) {
    return;
  }

  const resolved = getDiscordTrigger(registry, interaction.commandName);
  if (!resolved) {
    context.logger.warn(
      {
        commandName: interaction.commandName,
        interactionId: interaction.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
      },
      "unknown action trigger",
    );
    return;
  }

  try {
    const invocation = toInvocation(interaction, resolved);
    await resolved.action.execute(invocation, context);
  } catch (error) {
    context.logger.error(
      {
        error,
        action: resolved.action.name,
        trigger: resolved.trigger.name,
        interactionId: interaction.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
      },
      "action trigger failed",
    );
    await sendFailure(interaction).catch((replyError) => {
      context.logger.error(
        { error: replyError },
        "failed to send action failure",
      );
    });
  }
}

function toInvocation(
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction,
  resolved: ResolvedDiscordTrigger,
): ActionInvocation {
  if (
    interaction.isChatInputCommand() &&
    resolved.trigger.kind === "slash_command"
  ) {
    return baseInvocation(
      interaction,
      resolved.trigger.parse(interaction),
      "slash_command",
    );
  }

  if (
    interaction.isMessageContextMenuCommand() &&
    resolved.trigger.kind === "message_context_menu"
  ) {
    return baseInvocation(
      interaction,
      resolved.trigger.parse(interaction),
      "message_context_menu",
    );
  }

  throw new Error(
    `Trigger ${resolved.trigger.name} cannot handle interaction ${interaction.commandType}`,
  );
}

function baseInvocation(
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction,
  args: unknown,
  source: "slash_command" | "message_context_menu",
): ActionInvocation {
  return {
    source,
    channelId: interaction.channelId,
    guildId: interaction.guildId ?? undefined,
    requester: {
      id: interaction.user.id,
      name: interaction.user.globalName ?? interaction.user.username,
    },
    triggerMessage: interaction.isMessageContextMenuCommand()
      ? interaction.targetMessage
      : undefined,
    interaction,
    args,
  };
}

async function sendFailure(
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction,
): Promise<void> {
  const content = "something broke while running that action.";
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ content, ephemeral: true });
    return;
  }

  await interaction.reply({ content, ephemeral: true });
}
