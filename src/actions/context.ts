import type { Client } from "discord.js";
import type { Schema } from "effect";
import type { Config } from "../config.js";
import type { LlmClient } from "../llm/client.js";
import type { ModelCatalog } from "../llm/model-catalog.js";
import type { Logger } from "../logger.js";
import type { GenerationQueue } from "../queue.js";
import type { SettingsStore } from "../settings/store.js";

export type Action = {
  name: string;
  description: string;
  inputSchema: Schema.Schema<unknown>;
  ownerOnly?: boolean;
  triggers: ActionTrigger[];
  availability(
    input: ActionAvailabilityInput,
    context: ActionContext,
  ): ActionAvailability;
  execute(
    invocation: ActionInvocation,
    context: ActionContext,
  ): Promise<ActionResult>;
};

export type ActionContext = {
  client: Client;
  config: Config;
  llm: LlmClient;
  logger: Logger;
  queue: GenerationQueue;
  modelCatalog: ModelCatalog;
  settings: SettingsStore;
};

export interface ActionTriggerBase {
  kind: string;
  name: string;
  description: string;
  usage: string;
  [key: string]: unknown;
}

export interface ToolCallTrigger extends ActionTriggerBase {
  kind: "tool_call";
  inputSchema: Schema.Schema<unknown>;
  inputSchemaJson?: unknown;
}

export type ActionTrigger = ActionTriggerBase | ToolCallTrigger;

export type ResolvedToolCallTrigger = {
  action: Action;
  trigger: ToolCallTrigger;
};

export type ActionInvocation = {
  source: string;
  channelId: string;
  guildId?: string | undefined;
  requester?: { id: string; name: string } | undefined;
  triggerMessage?: unknown;
  interaction?: unknown;
  args: unknown;
};

export type ActionAvailabilityInput = {
  channelId: string;
  guildId?: string | undefined;
  isThread: boolean;
  triggerMessage?: unknown;
};

export type ActionAvailability =
  | { available: true; reason?: string | undefined }
  | { available: false; reason: string };

export type ActionResult =
  | { kind: "handled" }
  | { kind: "not_applicable"; reason: string };

export function isToolCallTrigger(
  trigger: ActionTrigger,
): trigger is ToolCallTrigger {
  return trigger.kind === "tool_call";
}
