import type { Client } from "discord.js";
import type { ActionRegistry } from "../../actions/registry.js";
import type { Logger } from "../../logger.js";
import { getDiscordTriggers } from "./triggers.js";

export async function registerDiscordActionTriggers(input: {
  client: Client<true>;
  registry: ActionRegistry;
  logger: Logger;
}): Promise<void> {
  const triggers = getDiscordTriggers(input.registry);
  const commands = triggers.map((entry) => entry.trigger.data);
  await input.client.application.commands.set(commands);
  await clearGuildCommands(input.client, input.logger);

  input.logger.debug(
    {
      actions: input.registry.actions.map((action) => action.name),
      triggers: triggers.map((entry) => entry.trigger.name),
    },
    "registered Discord action triggers",
  );
}

async function clearGuildCommands(
  readyClient: Client<true>,
  logger: Logger,
): Promise<void> {
  for (const guild of readyClient.guilds.cache.values()) {
    try {
      await guild.commands.set([]);
      logger.debug({ guildId: guild.id }, "cleared guild commands");
    } catch (error) {
      logger.warn(
        { error, guildId: guild.id },
        "failed to clear guild commands",
      );
    }
  }
}
