import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type BotIdentity = {
  name: string;
  pronouns: string;
  aliases: string[];
  project: string;
  background: string;
  hobbies: string[];
};

export const DEFAULT_BOT_IDENTITY: BotIdentity = {
  name: "Patch",
  pronouns: "she/her",
  aliases: ["patch"],
  project: "Patch",
  background:
    "a cartoon bear plushie and the face of the Patch music/producer project",
  hobbies: [
    "drum & bass",
    "future garage",
    "melodic electronic music",
    "neoy2k nostalgia",
  ],
};

let cachedIdentity: BotIdentity | undefined;

export function getBotIdentity(): BotIdentity {
  cachedIdentity ??= loadBotIdentity();
  return cachedIdentity;
}

export function reloadBotIdentity(): BotIdentity {
  cachedIdentity = loadBotIdentity();
  return cachedIdentity;
}

export function loadBotIdentity(
  env: NodeJS.ProcessEnv = process.env,
): BotIdentity {
  return withEnvOverrides(loadIdentityFile(env), env);
}

export function renderIdentityTemplate(
  template: string,
  identity: BotIdentity = getBotIdentity(),
): string {
  return template.replace(
    /{{\s*identity\.([a-zA-Z0-9_]+)\s*}}/g,
    (match, key) => {
      const value = identity[key as keyof BotIdentity];
      if (Array.isArray(value)) return value.join(", ");
      if (typeof value === "string") return value;
      return match;
    },
  );
}

function loadIdentityFile(env: NodeJS.ProcessEnv): BotIdentity {
  const identityPath =
    env.BOT_IDENTITY_PATH ?? env.IDENTITY_PATH ?? "prompts/identity.json";
  const resolvedPath = resolve(process.cwd(), identityPath);
  if (!existsSync(resolvedPath)) return DEFAULT_BOT_IDENTITY;

  const parsed = JSON.parse(readFileSync(resolvedPath, "utf8")) as unknown;
  if (!isIdentityInput(parsed)) return DEFAULT_BOT_IDENTITY;

  return normalizeIdentity(parsed);
}

function withEnvOverrides(
  identity: BotIdentity,
  env: NodeJS.ProcessEnv,
): BotIdentity {
  return normalizeIdentity({
    ...identity,
    name: env.BOT_NAME ?? identity.name,
    pronouns: env.BOT_PRONOUNS ?? identity.pronouns,
    aliases: env.BOT_ALIASES ? splitCsv(env.BOT_ALIASES) : identity.aliases,
    project: env.BOT_PROJECT ?? identity.project,
    background: env.BOT_BACKGROUND ?? identity.background,
    hobbies: env.BOT_HOBBIES ? splitCsv(env.BOT_HOBBIES) : identity.hobbies,
  });
}

type IdentityInput = Partial<Record<keyof BotIdentity, unknown>>;

function isIdentityInput(value: unknown): value is IdentityInput {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeIdentity(input: IdentityInput): BotIdentity {
  const name = stringOr(input.name, DEFAULT_BOT_IDENTITY.name);
  return {
    name,
    pronouns: stringOr(input.pronouns, DEFAULT_BOT_IDENTITY.pronouns),
    aliases: nonEmptyStrings(input.aliases, [name.toLowerCase()]),
    project: stringOr(input.project, name),
    background: stringOr(input.background, DEFAULT_BOT_IDENTITY.background),
    hobbies: nonEmptyStrings(input.hobbies, DEFAULT_BOT_IDENTITY.hobbies),
  };
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nonEmptyStrings(value: unknown, fallback: string[]): string[] {
  const items = Array.isArray(value)
    ? value.flatMap((item) => (typeof item === "string" ? [item.trim()] : []))
    : typeof value === "string"
      ? splitCsv(value)
      : [];
  return items.length ? items : fallback;
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
