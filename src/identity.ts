import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type InterestValue = string | string[] | InterestRecord;
export interface InterestRecord {
  [key: string]: InterestValue;
}
export type InterestBank = string[] | InterestRecord;

export type BotIdentity = {
  name: string;
  pronouns: string;
  aliases: string[];
  project: string;
  background: string;
  interests: InterestBank;
  hobbies: string[];
};

export const DEFAULT_BOT_IDENTITY: BotIdentity = {
  name: "Patch",
  pronouns: "she/her",
  aliases: ["patch"],
  project: "Patch",
  background:
    "a cartoon bear plushie and the face of the Patch music/producer project",
  interests: {
    music: {
      genres: [
        "drum & bass",
        "future garage",
        "melodic electronic music",
        "neoy2k nostalgia",
      ],
      artists: [],
    },
    art: {
      styles: [],
      artists: [],
    },
    media: {
      genres: [],
      actorsComedians: [],
    },
  },
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
      if (isInterestBank(value)) return formatInterestBank(value);
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
    interests: env.BOT_HOBBIES
      ? interestsFromLegacyHobbies(splitCsv(env.BOT_HOBBIES))
      : identity.interests,
  });
}

type IdentityInput = Partial<Record<keyof BotIdentity, unknown>>;

function isIdentityInput(value: unknown): value is IdentityInput {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeIdentity(input: IdentityInput): BotIdentity {
  const name = stringOr(input.name, DEFAULT_BOT_IDENTITY.name);
  const interests = normalizeInterestBank(input.interests, input.hobbies);
  return {
    name,
    pronouns: stringOr(input.pronouns, DEFAULT_BOT_IDENTITY.pronouns),
    aliases: nonEmptyStrings(input.aliases, [name.toLowerCase()]),
    project: stringOr(input.project, name),
    background: stringOr(input.background, DEFAULT_BOT_IDENTITY.background),
    interests,
    hobbies: nonEmptyStrings(input.hobbies, flattenInterestBank(interests)),
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

function normalizeInterestBank(
  value: unknown,
  legacyHobbies: unknown,
): InterestBank {
  if (Array.isArray(value) || typeof value === "string") {
    return nonEmptyStrings(value, DEFAULT_BOT_IDENTITY.hobbies);
  }

  if (!isRecord(value)) {
    return Array.isArray(legacyHobbies) || typeof legacyHobbies === "string"
      ? interestsFromLegacyHobbies(nonEmptyStrings(legacyHobbies, []))
      : DEFAULT_BOT_IDENTITY.interests;
  }

  const normalized = normalizeInterestRecord(value);
  return Object.keys(normalized).length
    ? normalized
    : DEFAULT_BOT_IDENTITY.interests;
}

function normalizeInterestRecord(
  value: Record<string, unknown>,
): InterestRecord {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) => {
      const normalized = normalizeInterestValue(child);
      return normalized === undefined ? [] : [[key, normalized]];
    }),
  );
}

function normalizeInterestValue(value: unknown): InterestValue | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    const values = value.flatMap((item) =>
      typeof item === "string" && item.trim() ? [item.trim()] : [],
    );
    return values.length ? values : undefined;
  }

  if (isRecord(value)) {
    const values = normalizeInterestRecord(value);
    return Object.keys(values).length ? values : undefined;
  }

  return undefined;
}

function interestsFromLegacyHobbies(hobbies: string[]): InterestBank {
  return {
    ...DEFAULT_BOT_IDENTITY.interests,
    music: {
      ...asInterestRecord(
        Array.isArray(DEFAULT_BOT_IDENTITY.interests)
          ? undefined
          : DEFAULT_BOT_IDENTITY.interests.music,
      ),
      genres: hobbies,
    },
  };
}

function flattenInterestBank(interests: InterestBank): string[] {
  if (Array.isArray(interests)) return interests;
  return Object.values(interests).flatMap(flattenInterestValue);
}

function flattenInterestValue(value: InterestValue): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value;
  return flattenInterestBank(value);
}

function formatInterestBank(interests: InterestBank): string {
  if (Array.isArray(interests)) return interests.join(", ");
  return formatInterestRecord(interests, []).join("; ");
}

function formatInterestRecord(
  interests: InterestBank,
  path: string[],
): string[] {
  return Object.entries(interests).flatMap(([key, value]) =>
    formatInterestValue(value, [...path, key]),
  );
}

function formatInterestValue(value: InterestValue, path: string[]): string[] {
  if (typeof value === "string")
    return [`${formatInterestPath(path)}: ${value}`];
  if (Array.isArray(value)) {
    return value.length
      ? [`${formatInterestPath(path)}: ${value.join(", ")}`]
      : [];
  }
  return formatInterestRecord(value, path);
}

function formatInterestPath(path: string[]): string {
  return path.map(humanizeKey).join(" ");
}

function humanizeKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
}

function isInterestBank(value: unknown): value is InterestBank {
  return Array.isArray(value) || isRecord(value);
}

function asInterestRecord(value: InterestValue | undefined): InterestRecord {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
