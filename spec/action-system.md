# Action system spec

## Goal

Make side effects action-first. An **action** is the canonical unit of work; Discord slash commands, context menus, autocomplete, and model-selected tool calls are triggers for actions.

Adding a new capability should mean defining one action with zero or more triggers, adding it to the registry, and letting the registry expose the correct surfaces.

For v1, implement the action system with a small bounded action set. V2 expands the same action space with external/data actions like web search, web fetch, and preference updates; those are still actions with triggers, not a separate tool architecture.

The planner can execute model-visible actions. The responder can see available actions as capability context, but does not directly execute them.

## Non-goals

- No dynamic filesystem discovery.
- No Discord Interactions Endpoint URL; interactions stay Gateway-handled.
- No command framework dependency.
- No external/data actions yet; web search/fetch and preference actions are v2 additions to the same action system.
- No open-ended action arguments.
- No model access to owner/admin actions.

## Shape

Use an action registry under `src/discord/actions/`:

```text
src/discord/actions/
  context.ts          shared runtime and invocation types
  permissions.ts      owner/helper guards
  registry.ts         registerAction() + trigger lookup maps
  register.ts         Discord command/context-menu registration
  dispatch.ts         Discord interaction routing + error handling
  action-context.ts   model-visible action/capability context
  planner.ts          model-visible action chooser
  delete.ts           delete_messages action + /delete trigger
  leave.ts            leave_thread action + /leave trigger + tool-call trigger
  model.ts            model_settings action + /model trigger + autocomplete
  reload.ts           reload_runtime action + /reload trigger
  summarize.ts        summarize action + /summarize + message context menu, later in v1
  debug.ts            owner-only debug actions, later in v1
```

`src/discord/commands.ts` should disappear or become a temporary compatibility re-export during migration.

## Action definitions

Each module exports one or more `Action`s. Triggers are metadata on the action.

```ts
export type Action = {
  name: string;
  description: string;
  inputSchema: Schema.Schema<unknown>;
  triggers: ActionTrigger[];
  availability(input: ActionAvailabilityInput, context: ActionContext): ActionAvailability;
  execute(invocation: ActionInvocation, context: ActionContext): Promise<ActionResult>;
};

export interface ActionTriggerBase {
  kind: string;
  name: string;
  description: string;
  usage: string;
}

export interface SlashCommandTrigger extends ActionTriggerBase {
  kind: "slash_command";
  data: SlashCommandBuilder;
  parse(interaction: ChatInputCommandInteraction): unknown;
  autocomplete?(interaction: AutocompleteInteraction, context: ActionContext): Promise<void>;
}

export interface MessageContextMenuTrigger extends ActionTriggerBase {
  kind: "message_context_menu";
  data: ContextMenuCommandBuilder;
  parse(interaction: MessageContextMenuCommandInteraction): unknown;
}

export interface ToolCallTrigger extends ActionTriggerBase {
  kind: "tool_call";
  inputSchema: Schema.Schema<unknown>;
}

export type ActionTrigger =
  | SlashCommandTrigger
  | MessageContextMenuTrigger
  | ToolCallTrigger;
```

`Action.name` is the stable action name, e.g. `leave_thread`. Trigger names are surface-specific aliases like `/leave`, `Summarize this reply chain`, or `leave_thread`. Trigger descriptions and usage text are written for that surface, not copied blindly from the action.

`ActionContext` contains shared dependencies:

```ts
export type ActionContext = {
  client: Client;
  config: Config;
  llm: LlmClient;
  logger: Logger;
  queue: GenerationQueue;
  modelCatalog: ModelCatalog;
  settings: SettingsStore;
};

export type ActionInvocation = {
  source: "slash_command" | "message_context_menu" | "tool_call";
  channelId: string;
  guildId?: string;
  requester?: { id: string; name: string };
  triggerMessage?: Message;
  interaction?: ChatInputCommandInteraction | MessageContextMenuCommandInteraction;
  args: unknown;
};

export type ActionAvailabilityInput = {
  channelId: string;
  guildId?: string;
  isThread: boolean;
  triggerMessage?: Message;
};

export type ActionAvailability =
  | { available: true; reason?: string }
  | { available: false; reason: string };

export type ActionResult =
  | { kind: "handled" }
  | { kind: "not_applicable"; reason: string };
```

Availability is checked before exposing actions to model prompts and again before execution. Prompt visibility is not a security boundary; action code remains authoritative.

## Registry

`registry.ts` owns a process-local action registry. Actions are registered explicitly from `index.ts`, a bootstrap module, or tests. Registration recursively indexes each action's triggers into the correct surface maps.

```ts
export type ActionRegistry = {
  actions: readonly Action[];
  discordCommands: readonly DiscordCommandTrigger[];
  toolCallTriggers: readonly ResolvedToolCallTrigger[];
  registerAction(action: Action): void;
  getAction(name: string): Action | undefined;
  getDiscordTrigger(commandName: string): ResolvedDiscordTrigger | undefined;
  getToolCallTrigger(name: string): ResolvedToolCallTrigger | undefined;
};

export const actionRegistry = createActionRegistry();
export function registerAction(action: Action): void;
export function registerDefaultActions(registry = actionRegistry): void;
```

`registerAction()`:

1. Validates and stores the action by `Action.name`.
2. Walks `action.triggers`.
3. Adds slash commands and message context menus to the Discord command surface.
4. Keeps slash-command autocomplete handlers attached to their slash trigger.
5. Adds tool-call triggers to the model-visible tool surface.
6. Fails fast on conflicts.

Example bootstrap:

```ts
registerAction(deleteMessagesAction);
registerAction(leaveThreadAction);
registerAction(modelSettingsAction);
registerAction(reloadRuntimeAction);
```

`registerDefaultActions()` can do this in production, while tests may create a fresh registry and register only the actions under test.

The registry fails fast on:

- duplicate action names
- duplicate trigger names on the same surface
- slash autocomplete handlers on triggers that do not define autocomplete options
- owner/admin actions with a `tool_call` trigger

Only safe persona/presence actions get a `tool_call` trigger. Owner/admin actions like delete, reload, debug, and model switching must not appear in the model-visible tool surface.

## Discord registration

`register.ts` owns Discord API registration:

```ts
export async function registerDiscordActionTriggers(input: {
  client: Client<true>;
  registry: ActionRegistry;
  logger: Logger;
}): Promise<void>
```

Behavior:

1. Read slash/context trigger data from `registry.discordCommands`.
2. `client.application.commands.set(triggerData)`.
3. Clear stale guild-scoped commands for every cached guild.
4. Log action names, trigger names, and guild cleanup failures.

`registerAction()` updates the in-process registry; `registerDiscordActionTriggers()` publishes the Discord-facing trigger set to Discord.

## Discord dispatch

`dispatch.ts` owns `InteractionCreate` routing:

```ts
export async function dispatchInteraction(
  interaction: Interaction,
  context: ActionContext,
): Promise<void>
```

Behavior:

1. If autocomplete, look up the slash command trigger by `interaction.commandName` and call its `autocomplete` handler when present.
2. If chat input or message context menu, look up by `interaction.commandName` and invoke the owning action.
3. Convert Discord options into the action's `args`.
4. Let each action own its interaction UX: ephemeral/public defer, edit, follow-up, etc.
5. Ignore unknown/unsupported interactions with a warning.
6. Log uncaught failures with action/trigger name, interaction id, channel id, guild id.
7. If the action has not replied/deferred, send an ephemeral failure reply where Discord supports it. If it has, edit/follow up according to Discord state.

`index.ts` should only wire this:

```ts
client.on(Events.InteractionCreate, interaction => {
  void dispatchInteraction(interaction, actionContext).catch(...);
});
```

## Model-visible actions as tools

`planner.ts` owns model-visible action choice. This is a bounded JSON planner/classifier call before normal response generation.

`action-context.ts` builds the shared action/capability context used by both planner and responder:

```ts
export type ModelVisibleAction = {
  actionName: string;
  name: string;
  description: string;
  usage: string;
  inputSchemaJson: unknown;
  available: boolean;
  unavailableReason?: string;
};

export function buildModelVisibleActions(input: {
  triggerMessage?: Message;
  channelId: string;
  guildId?: string;
  context: ActionContext;
}): ModelVisibleAction[];
```

Only `tool_call` triggers are included. Owner/admin actions never appear. Planner output uses `ModelVisibleAction.name`, and the registry maps that trigger name back to the owning action.

### Planner access

```ts
export type PlannerDecision =
  | { action: "ignore"; reason: string }
  | { action: "respond"; reason: string; responsePlan?: ResponsePlan }
  | { action: string; args: unknown; reason: string };

export type ResponsePlan = {
  tone?: string;
  style?: string;
  splitPreference?: "single_message" | "natural_burst" | "structured";
};

export async function chooseActionOrResponse(input: {
  transcript: string;
  triggerMessage: Message;
  triggerKind: "manual" | "passive";
  context: ActionContext;
}): Promise<PlannerDecision>;
```

Prompt shape:

- system: normal identity/transcript/safety rules plus compact action-use rules
- user: transcript + JSON `ModelVisibleAction[]`
- output only compact JSON
- `temperature: 0`
- `maxTokens: 192`
- `enableThinking: false`

Decision rules:

- Manual triggers default to `respond`; they must not choose `ignore`.
- Passive triggers default to `ignore` when uncertain.
- Choose an action only when the latest message clearly asks Patch to perform it, or when the action is socially obvious, safe, and available.
- Never choose unavailable actions. If the chosen action returns `not_applicable`, fall back to normal response generation with the reason as context.
- If choosing `respond`, include only compact style/tone guidance. Do not draft the final response in the planner.

### Responder access

The responder receives compact action/capability context for awareness, not execution:

```xml
<available_actions>
{"name":"leave_thread","description":"Leave the current thread after a farewell","available":true}
</available_actions>
```

Responder rules:

- Use available actions to answer capability questions accurately.
- Do not emit tool calls, JSON, or action names as commands to the harness.
- If the user asks Patch to perform an available action and the responder is being called, assume the planner intentionally chose `respond`; answer normally or clarify, but do not fake execution.

Response pipeline:

```text
manual trigger or passive trigger
└─ build transcript
   └─ chooseActionOrResponse
      ├─ action=ignore        -> stop, passive only
      ├─ action=respond       -> normal response generation with responsePlan + available_actions
      └─ action=<patch_action>
         ├─ handled           -> stop
         └─ not_applicable    -> normal response generation with reason as context
```

This keeps Patch aware of her available actions without hard-coding every phrase in `index.ts`, while keeping execution bounded in action code.

## Permissions

`permissions.ts`:

```ts
export function isOwner(userId: string, config: Config): boolean;
export async function requireOwner(interaction, config): Promise<boolean>;
```

`requireOwner` replies ephemeral `nope, owner-only.` and returns `false`.

Use owner gating inside action modules, not in dispatcher, so permissions stay local and obvious.

## Initial action responsibilities

### `delete_messages`

File: `delete.ts`

Triggers:

- Slash command `/delete count:N`.
- Owner-only.
- Not model-visible.

Behavior:

- Ephemeral defer.
- Deletes Patch's latest messages in current channel using individual deletes only.
- Own helper functions currently in `commands.ts`:
  - collect latest bot messages
  - fetch pages
  - delete individually

### `reload_runtime`

File: `reload.ts`

Triggers:

- Slash command `/reload`.
- Owner-only.
- Not model-visible.

Behavior:

- Ephemeral immediate reply.
- Calls `reloadPromptFiles()`.
- Logs user id and cleared count.

### `model_settings`

File: `model.ts`

Triggers:

- Slash command `/model name:<optional>` with an inline autocomplete handler for `name`.
- Owner-only.
- Not model-visible.

Behavior:

- Without `name`, show current model.
- With `name`, persist to `SettingsStore`.
- Autocomplete uses `ModelCatalog` and includes current model.

### `leave_thread`

File: `leave.ts`

Triggers:

- Slash command `/leave`.
- Tool-call trigger `leave_thread`.
- Model-visible.

Slash behavior:

- Guild/thread only.
- Public defer.
- Validate current channel is a thread.
- Queue at `priority: "leave"`, `bucketKey: channel.id`.
- Invoke `leave_thread` with source `slash_command` and requester = slash command user.
- Edit the slash command reply with the farewell.
- Then leave the thread.

Model-visible behavior:

- Available only in threads/forum posts where Patch is a member.
- Generates farewell from same normal response rule prompts plus leave prompt.
- Sends the farewell as a normal public message when invoked by model.
- Leaves the thread after the farewell is sent.
- Returns `handled` so no normal response is generated.

Model decision criteria:

- Choose `leave_thread` when someone directly tells Patch to leave, asks Patch to go away, says Patch should stop participating in this thread, or the room explicitly agrees Patch should leave.
- Do not choose it merely because someone criticizes a bad reply, says Patch is wrong, or roasts her. Those should be normal replies or silence depending on classifier/planner.
- Do not choose it in normal guild channels or DMs.

## Later v1 actions

### `summarize_context`

Triggers:

- Slash command `/summarize message:<url-or-id optional>`.
- Message context menu `Summarize this reply chain`.
- Not model-visible for v1 unless explicitly revisited.

### `debug_context`

Triggers:

- Slash command `/debug-context message:<url-or-id optional>`.
- Owner-only.
- Not model-visible.

### `debug_classify`

Triggers:

- Slash command `/debug-classify`.
- Owner-only.
- Not model-visible.

## Testing plan

Add focused unit tests where practical:

- registry rejects duplicate action names
- registry rejects duplicate trigger names on the same surface
- registry rejects invalid slash autocomplete wiring
- registry rejects tool-call triggers on admin actions
- `getAction` returns expected action
- `getDiscordTrigger` returns owning action + trigger
- model-visible tool surface excludes delete/reload/model/debug actions
- planner decision parser rejects non-JSON / unknown action / unavailable action / invalid args
- leave action returns `not_applicable` outside threads
- leave action selection fixtures:
  - `@Patch leave` -> `leave_thread`
  - `Patch can you leave this thread` -> `leave_thread`
  - `bot is annoying` -> `respond` or passive false, not leave
  - human-to-human `@Mia make Patch leave` -> passive false unless Patch is directly asked
- delete collection/deletion helpers with mocked channel/messages
- permission helper replies once and returns false

Integration behavior can stay manually validated with `pnpm dev` until Discord interaction mocks are worth building.

## Migration steps

1. Add `context.ts`, `registry.ts`, `register.ts`, `dispatch.ts`, `permissions.ts` under `src/discord/actions/`.
2. Wire `registerDefaultActions()` in startup before Discord command registration and interaction dispatch.
3. Move `/reload` into `reload.ts` as `reload_runtime`.
4. Move `/delete` into `delete.ts` as `delete_messages`.
5. Move `/model` into `model.ts` as `model_settings` with slash-command autocomplete.
6. Move `/leave` from `src/discord/leave.ts` into `actions/leave.ts` and factor its side effect into `leave_thread`.
7. Replace `index.ts` interaction branching with `dispatchInteraction`.
8. Add `action-context.ts` and expose model-visible actions to planner/responder.
9. Add `planner.ts` and model-visible action prompt.
10. Insert action decision between accepted trigger and normal response generation.
11. Delete old `src/discord/commands.ts` and old leave entrypoint once imports are gone.
12. Run `pnpm run check && pnpm test && pnpm run build`.
