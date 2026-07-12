# Settings database

Patch runtime settings should be stored in SQLite and described by the shared Drizzle schema in `src/db/schema.ts`.

Settings are different from prompt files and identity data:

- Prompt files are versioned behavior assets.
- Identity data is persona/profile data.
- Settings are small runtime configuration values that can change without editing files or redeploying.

## Goals

- Keep runtime settings persistent across restarts.
- Let owner-only actions like `/model` update settings safely.
- Move settings schema ownership from ad-hoc SQL in `SettingsStore` to Drizzle.
- Preserve compatibility with the existing `settings` table in `data/patch.sqlite`.
- Keep values simple until a setting needs a richer table.

## Non-goals

- Do not store secrets in this table. API keys stay in environment variables or a secrets manager.
- Do not store prompt text here. Prompt assets remain Markdown/JSON files under `prompts/`.
- Do not store large user memory here. Use purpose-built tables for memory/preferences later.
- Do not expose settings as model-visible tools unless an action explicitly needs them.

## Current table

The existing runtime DB already has this table, created by `src/settings/store.ts`:

```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
```

Drizzle schema should model the same logical shape:

```text
settings
  key         stable setting key
  value       string value
  updated_at  last write timestamp
```

Current known setting:

| Key | Meaning | Writer | Reader |
| --- | --- | --- | --- |
| `llm_model` | Active LLM model name/alias. | owner-only `/model` action | response/classifier/LLM routing |

## Key/value policy

Use the key/value table for small scalar settings only.

Good settings:

- `llm_model`
- future feature flags
- selected prompt preset
- scheduler enable/disable toggles
- last selected non-secret runtime modes

Bad settings:

- API tokens or secrets
- large JSON blobs
- prompt bodies
- interest graph data
- per-user memories
- sync event history

If a setting grows structure, promote it to a typed table instead of hiding a schema in `settings.value`.

## Value encoding

`value` is stored as text.

Recommended conventions:

| Value type | Encoding |
| --- | --- |
| string | raw string |
| boolean | `true` / `false` |
| integer | decimal string |
| enum | exact enum string |
| JSON | avoid unless temporary; prefer a typed table |

Validation belongs at the setting-specific boundary. For example, `setLlmModel()` trims and rejects empty model names.

## Migration plan

1. Add `settings` to `src/db/schema.ts`.
2. Generate a Drizzle migration that includes `settings` for fresh databases.
3. Before applying to an existing runtime DB, avoid recreating `settings` if it already exists.
4. Update `SettingsStore` to use a Drizzle-backed DB adapter or a shared migration/bootstrap path.
5. Keep tests that assert:
   - default `llm_model` is seeded only when missing
   - model changes persist across reopen
   - empty values are rejected

Important: Drizzle-generated SQLite migrations use plain `CREATE TABLE`, while the existing runtime table may already exist and is `STRICT`. For the first production migration, either:

- baseline the existing DB before applying Drizzle migrations, or
- hand-edit the first migration to use `CREATE TABLE IF NOT EXISTS settings (...)`, or
- run a one-time bootstrap that ensures `settings` before Drizzle migrates interest tables.

Do not drop/recreate `settings`; it contains the currently selected runtime model.

## Drizzle schema

Current Drizzle declaration:

```ts
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
```

Drizzle does not currently encode the existing SQLite `STRICT` table modifier in this schema. That is acceptable for logical schema ownership, but production migration should preserve the existing table rather than replacing it.

## Store API

Keep the public store API narrow:

```ts
class SettingsStore {
  getLlmModel(): string;
  setLlmModel(model: string): void;
  close(): void;
}
```

Future settings can add typed methods rather than exposing generic `get(key)` / `set(key)` broadly. Generic access is useful internally, but action code should use named methods.

## Future settings

Possible future keys:

| Key | Notes |
| --- | --- |
| `interest_sync_enabled` | Global switch for scheduled interest syncs. |
| `interest_sync_last_started_at` | Maybe a sync table owns this instead. Prefer `sync_runs`. |
| `response_style_preset` | Only if style presets become runtime selectable. |
| `classifier_enabled` | Only if runtime toggling is desired. Env is fine for static deploy config. |

Prefer typed tables for anything with lifecycle, history, ownership, or multiple rows.
