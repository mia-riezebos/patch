# Command system spec

## Goal

Make slash commands isolated, testable modules instead of one shared `commands.ts` file plus ad-hoc handlers in `index.ts`.

Adding a command should mean creating one file, exporting a command definition, and adding it to a registry list.

Commands should also be backed by reusable actions. Slash commands are one way to invoke an action; Patch can also choose safe actions herself when conversation context clearly calls for it.

## Non-goals

- No dynamic filesystem command discovery for now.
- No Discord Interactions Endpoint URL; commands stay Gateway-handled.
- No command framework dependency.
- Do not expose owner/admin actions as model-callable tools.

## Shape

Use a small command registry under `src/discord/commands/`:

```text
src/discord/commands/
  context.ts          shared runtime types
  permissions.ts      owner/helper guards
  registry.ts         all command/action definitions
  register.ts         global registration + stale guild cleanup
  dispatch.ts         interaction routing + error logging
  tool-decision.ts    model-visible action chooser
  delete.ts           /delete
  leave.ts            /leave + model-callable leave action
  reload.ts           /reload
```

`src/discord/commands.ts` should either disappear or become a temporary compatibility re-export during migration.

## Action and command definitions

Each module may export a reusable `PatchAction`, a slash `DiscordCommand`, or both.

```ts
export type PatchAction = {
  name: string;
  description: string;
  modelVisible: boolean;
  inputSchema: Schema.Schema<unknown>;
  execute(invocation: ActionInvocation, context: CommandContext): Promise<ActionResult>;
};

export type DiscordCommand = {
  name: string;
  data: SlashCommandBuilder;
  execute(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<void>;
};
```

`name` must match `data.name` for slash commands. Action names should be verb phrases, e.g. `leave_thread`.

`CommandContext` contains shared dependencies:

```ts
export type CommandContext = {
  client: Client;
  config: Config;
  llm: LlmClient;
  logger: Logger;
  queue: GenerationQueue;
};

export type ActionInvocation = {
  source: "slash_command" | "model";
  channelId: string;
  guildId?: string;
  requester?: { id: string; name: string };
  triggerMessage?: Message;
  args: unknown;
};

export type ActionResult =
  | { kind: "handled" }
  | { kind: "not_applicable"; reason: string };
```

Commands own their interaction behavior:

- `/delete`: ephemeral defer/reply
- `/reload`: ephemeral reply
- `/leave`: public defer; generated farewell is the command reply

Actions own the side effect. Slash commands translate Discord options into an action invocation. Model tool-use translates conversation context into the same action invocation.

## Registry

`registry.ts` exports the canonical command and action lists:

```ts
export const DISCORD_COMMANDS = [
  deleteCommand,
  leaveCommand,
  reloadCommand,
] satisfies DiscordCommand[];

export const PATCH_ACTIONS = [
  leaveThreadAction,
] satisfies PatchAction[];

export const MODEL_VISIBLE_ACTIONS = PATCH_ACTIONS.filter(
  (action) => action.modelVisible,
);
```

It also exports `getCommand(name)` and `getAction(name)` via maps and should fail fast on duplicate names.

Only safe persona/presence actions are model-visible. `/delete` and `/reload` are owner/admin controls, so they must not appear in `MODEL_VISIBLE_ACTIONS`.

## Registration

`register.ts` owns Discord registration:

```ts
export async function registerCommands(client: Client<true>, logger: Logger): Promise<void>
```

Behavior:

1. `client.application.commands.set(DISCORD_COMMANDS.map(command => command.data))`
2. Clear stale guild-scoped commands for every cached guild.
3. Log command names and guild cleanup failures.

## Slash dispatch

`dispatch.ts` owns `InteractionCreate` routing:

```ts
export async function dispatchCommand(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
): Promise<void>
```

Behavior:

1. Look up by `interaction.commandName`.
2. Ignore unknown commands with a warning.
3. Execute command.
4. Log uncaught command failures with command name, interaction id, channel id, guild id.
5. If the command has not replied/deferred, send an ephemeral failure reply. If it has, edit/follow up according to Discord state.

`index.ts` should only wire this:

```ts
client.on(Events.InteractionCreate, interaction => {
  if (!interaction.isChatInputCommand()) return;
  void dispatchCommand(interaction, commandContext).catch(...);
});
```

## Model action decision

`tool-decision.ts` owns the model-visible action chooser. This is not OpenAI function calling; it is a bounded JSON classifier-style call before normal response generation.

```ts
export type ToolDecision =
  | { action: "respond"; reason: string }
  | { action: string; args: unknown; reason: string };

export async function chooseActionOrResponse(input: {
  transcript: string;
  triggerMessage: Message;
  context: CommandContext;
}): Promise<ToolDecision>;
```

Prompt shape:

- system: normal identity/transcript/safety rules plus a compact tool-use prompt
- user: transcript + JSON descriptions for `MODEL_VISIBLE_ACTIONS`
- output only compact JSON
- `temperature: 0`
- `maxTokens: 128`
- `enableThinking: false`

Decision rules:

- Default to `{ "action": "respond" }`.
- Choose a tool only when the latest message clearly asks Patch to perform that action, or when the action is socially obvious and safe.
- Never choose owner/admin tools because they are not model-visible.
- If the chosen action returns `not_applicable`, fall back to normal response generation.

Response pipeline:

```text
manual trigger or accepted passive trigger
└─ build transcript
   └─ chooseActionOrResponse
      ├─ action=respond -> normal response generation
      └─ action=<tool>  -> execute action; skip normal response when result is handled
```

This keeps Patch aware of her available actions without hard-coding every phrase in `index.ts`.

## Permissions

`permissions.ts`:

```ts
export function isOwner(interaction: ChatInputCommandInteraction, config: Config): boolean;
export async function requireOwner(interaction, config): Promise<boolean>;
```

`requireOwner` replies ephemeral `nope, owner-only.` and returns `false`.

Use owner gating inside command modules, not in dispatcher, so command permissions stay local and obvious.

## Command module responsibilities

### `/delete`

File: `delete.ts`

- Builder: name `delete`, count option 1..100.
- Owner-only.
- Ephemeral defer.
- Deletes Patch's latest messages in current channel using individual deletes only.
- Own helper functions currently in `commands.ts`:
  - collect latest bot messages
  - fetch pages
  - delete individually

### `/reload`

File: `reload.ts`

- Builder: name `reload`.
- Owner-only.
- Ephemeral immediate reply.
- Calls `reloadPromptFiles()`.
- Logs user id and cleared count.

### `/leave` / `leave_thread`

File: `leave.ts`

Slash command behavior:

- Builder: name `leave`, guild/thread only.
- Public defer.
- Validate current channel is a thread.
- Queue at `priority: "leave"`, `bucketKey: channel.id`.
- Invoke `leave_thread` with source `slash_command` and requester = slash command user.
- Edit the slash command reply with the farewell.
- Then leave the thread.

Model-visible action behavior:

- Action name: `leave_thread`.
- `modelVisible: true`.
- Available only in threads/forum posts where Patch is a member.
- Generates farewell from same normal response rule prompts plus leave prompt.
- Sends the farewell as a normal public message when invoked by model.
- Leaves the thread after the farewell is sent.
- Returns `handled` so no normal response is generated.

Model decision criteria:

- Choose `leave_thread` when someone directly tells Patch to leave, asks Patch to go away, says Patch should stop participating in this thread, or the room explicitly agrees Patch should leave.
- Do not choose it merely because someone criticizes a bad reply, says Patch is wrong, or roasts her. Those should be normal replies or silence depending on classifier.
- Do not choose it in normal guild channels or DMs.

## Testing plan

Add focused unit tests where practical:

- registry rejects duplicate command names
- registry rejects duplicate action names
- `getCommand` returns expected command
- `getAction` returns expected action
- model-visible action list excludes `/delete` and `/reload`
- tool decision parser rejects non-JSON / unknown action / invalid args
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

1. Add `context.ts`, `registry.ts`, `register.ts`, `dispatch.ts`, `permissions.ts`.
2. Move `/reload` into `reload.ts`.
3. Move `/delete` into `delete.ts`.
4. Move `/leave` from `src/discord/leave.ts` into `commands/leave.ts` and factor its side effect into `leaveThreadAction`.
5. Replace `index.ts` command branching with `dispatchCommand`.
6. Add `tool-decision.ts` and model-visible action prompt.
7. Insert action decision between accepted trigger and normal response generation.
8. Delete old `src/discord/commands.ts` and old leave entrypoint once imports are gone.
9. Run `pnpm run check && pnpm test && pnpm run build`.
