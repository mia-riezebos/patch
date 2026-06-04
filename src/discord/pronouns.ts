import type { Logger } from "../logger.js";

export interface PronounProvider {
  getPronouns(userId: string, guildId?: string): Promise<string | undefined>;
}

type CacheEntry = {
  expiresAt: number;
  pronouns?: string;
};

type PronounsPageLookup = {
  username?: string;
};

export type PronounsPageProfile = {
  profiles?: Array<{
    locale?: string;
    pronouns?: Array<{
      value?: string;
      opinion?: string;
    }>;
  }>;
};

const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
const PRONOUNS_PAGE_API_BASE_URL = "https://en.pronouns.page/api/public/v3";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5_000;
const MISSING_PRONOUNS = "missing";
const PRONOUN_ALIASES = new Map([
  ["she", "she/her"],
  ["her", "she/her"],
  ["she/her", "she/her"],
  ["he", "he/him"],
  ["him", "he/him"],
  ["he/him", "he/him"],
  ["they", "they/them"],
  ["them", "they/them"],
  ["they/them", "they/them"],
  ["it", "it/its"],
  ["its", "it/its"],
  ["it/its", "it/its"],
  ["xe", "xe/xem"],
  ["xem", "xe/xem"],
  ["xe/xem", "xe/xem"],
  ["ze", "ze/zir"],
  ["zir", "ze/zir"],
  ["ze/zir", "ze/zir"],
  ["fae", "fae/faer"],
  ["faer", "fae/faer"],
  ["fae/faer", "fae/faer"],
  ["any", "any pronouns"],
  ["ask", "ask pronouns"],
]);
const PRONOUN_WORDS = new Set(
  [...PRONOUN_ALIASES.keys()].flatMap((value) => value.split("/")),
);

export class DiscordPronounProvider implements PronounProvider {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly discordToken: string,
    private readonly logger: Logger,
    private readonly overrides: ReadonlyMap<string, string> = new Map(),
  ) {}

  async getPronouns(
    userId: string,
    guildId?: string,
  ): Promise<string | undefined> {
    const override = sanitizePronouns(this.overrides.get(userId));
    if (override) return override;

    const key = `${guildId ?? "global"}:${userId}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.pronouns;

    const pronouns =
      sanitizePronouns(await this.fetchPronouns(userId, guildId)) ??
      MISSING_PRONOUNS;
    this.cache.set(key, { pronouns, expiresAt: Date.now() + CACHE_TTL_MS });
    return pronouns;
  }

  private async fetchPronouns(
    userId: string,
    guildId: string | undefined,
  ): Promise<string | undefined> {
    const pronounsPagePronouns = await this.fetchPronounsPagePronouns(userId);
    if (pronounsPagePronouns) return pronounsPagePronouns;

    for (const path of profilePaths(userId, guildId)) {
      const profile = await this.fetchDiscordProfile(path);
      const pronouns = findDiscordPronouns(profile);
      if (pronouns) return pronouns;
    }

    return undefined;
  }

  private async fetchPronounsPagePronouns(
    userId: string,
  ): Promise<string | undefined> {
    const lookup = await this.fetchJson<PronounsPageLookup>(
      `${PRONOUNS_PAGE_API_BASE_URL}/user/social-lookup/discord/${userId}`,
      "Pronouns.page Discord lookup failed",
    );
    if (!lookup?.username) return undefined;

    const profile = await this.fetchJson<PronounsPageProfile>(
      `${PRONOUNS_PAGE_API_BASE_URL}/profile/get/${encodeURIComponent(
        lookup.username,
      )}`,
      "Pronouns.page profile fetch failed",
    );

    return extractPronounsPagePronouns(profile);
  }

  private async fetchDiscordProfile(path: string): Promise<unknown> {
    return this.fetchJson(`${DISCORD_API_BASE_URL}${path}`, undefined, {
      Authorization: `Bot ${this.discordToken}`,
    });
  }

  private async fetchJson<T>(
    url: string,
    failureMessage = "pronoun fetch failed",
    headers: Record<string, string> = {},
  ): Promise<T | undefined> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "PatchBot/0.1", ...headers },
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.debug(
          { url, status: response.status, statusText: response.statusText },
          failureMessage,
        );
        return undefined;
      }
      return (await response.json()) as T;
    } catch (error) {
      this.logger.debug({ error, url }, failureMessage);
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function profilePaths(userId: string, guildId: string | undefined): string[] {
  const query = guildId
    ? `?with_mutual_guilds=false&guild_id=${guildId}`
    : "?with_mutual_guilds=false";
  return [`/users/${userId}/profile${query}`];
}

export function extractPronounsPagePronouns(
  profile: PronounsPageProfile | undefined,
): string | undefined {
  const profiles = preferredPronounsPageProfiles(profile);
  const accepted = profiles.flatMap((entry) =>
    (entry.pronouns ?? [])
      .filter((pronoun) => isAcceptedPronounsPageOpinion(pronoun.opinion))
      .flatMap((pronoun) => normalizePronounValue(pronoun.value) ?? []),
  );
  return accepted.length > 0 ? unique(accepted).join(", ") : undefined;
}

function findDiscordPronouns(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase() === "pronouns" && typeof child === "string") {
      return child;
    }

    const nested = findDiscordPronouns(child);
    if (nested) return nested;
  }

  return undefined;
}

function preferredPronounsPageProfiles(
  profile: PronounsPageProfile | undefined,
): NonNullable<PronounsPageProfile["profiles"]> {
  const profiles = profile?.profiles ?? [];
  const englishProfiles = profiles.filter((entry) => entry.locale === "en");
  return englishProfiles.length > 0 ? englishProfiles : profiles;
}

function isAcceptedPronounsPageOpinion(opinion: string | undefined): boolean {
  const normalized = opinion?.toLowerCase();
  return normalized === "yes" || normalized === "okay" || normalized === "meh";
}

function sanitizePronouns(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const parts = value
    .split(",")
    .flatMap((part) => sanitizePronounPart(part) ?? []);
  return parts.length > 0 ? unique(parts).join(", ") : undefined;
}

function sanitizePronounPart(value: string): string | undefined {
  const normalized = value
    .trim()
    .toLowerCase()
    .replaceAll(/\|+/g, "/")
    .replaceAll(/\s+/g, " ");
  if (!normalized || normalized.length > 64) return undefined;

  const words = normalized.match(/[a-z]+/g) ?? [];
  const hasKnownPronounWord = words.some((word) => PRONOUN_WORDS.has(word));
  const looksLikeCustomPronouns = normalized.includes("/") && words.length >= 2;
  if (!hasKnownPronounWord && !looksLikeCustomPronouns) return undefined;

  return normalized;
}

function normalizePronounValue(value: string | undefined): string | undefined {
  const custom = normalizeCustomPronounValue(value);
  if (custom) return custom;

  const sanitized = sanitizePronounPart(value ?? "");
  if (!sanitized) return undefined;
  return PRONOUN_ALIASES.get(sanitized) ?? sanitized;
}

function normalizeCustomPronounValue(
  value: string | undefined,
): string | undefined {
  const stem = value?.trim().match(/^:([\p{Letter}\p{Number}_-]+)$/u)?.[1];
  if (!stem) return undefined;

  const normalizedStem = stem.toLowerCase().replaceAll(/[_-]+/g, " ").trim();
  if (!normalizedStem || normalizedStem.length > 32) return undefined;
  return `${normalizedStem}/${normalizedStem}'s`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
