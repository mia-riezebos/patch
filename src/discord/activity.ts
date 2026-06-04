import { type Client, ActivityType as DiscordActivityType } from "discord.js";
import type { Config } from "../config.js";
import type { LlmClient } from "../llm/client.js";
import type { Logger } from "../logger.js";
import { buildActivityMessages } from "../prompts/activity.js";
import type { GenerationQueue } from "../queue.js";
import { stripUnicodeEmoji } from "./no-emoji.js";

const MAX_ACTIVITY_NAME_LENGTH = 48;
const ACTIVITY_TIMEOUT_MS = 30_000;
const ACTIVITY_TYPES = [
  DiscordActivityType.Playing,
  DiscordActivityType.Listening,
  DiscordActivityType.Watching,
  DiscordActivityType.Competing,
] as const;
const DEFAULT_ACTIVITY: GeneratedActivity = {
  type: DiscordActivityType.Playing,
  name: "debug chicken",
};
const ALLOWED_ACTIVITY_TYPES = new Set<ActivityKind>(ACTIVITY_TYPES);
const LEGACY_ACTIVITY_TYPES = {
  Playing: DiscordActivityType.Playing,
  Listening: DiscordActivityType.Listening,
  Watching: DiscordActivityType.Watching,
  Competing: DiscordActivityType.Competing,
} as const;

type ActivityKind =
  | DiscordActivityType.Playing
  | DiscordActivityType.Listening
  | DiscordActivityType.Watching
  | DiscordActivityType.Competing;

type GeneratedActivity = {
  type: ActivityKind;
  name: string;
};

export function startActivityLoop(options: {
  client: Client<true>;
  config: Config;
  llm: LlmClient;
  logger: Logger;
  queue: GenerationQueue;
}): void {
  const { client, config, llm, logger, queue } = options;
  if (!config.activityUpdatesEnabled) return;

  let inFlight = false;
  let lastActivityType: ActivityKind | undefined;
  const update = async () => {
    if (inFlight) return;
    inFlight = true;

    try {
      const requestedType = chooseActivityType(lastActivityType);
      lastActivityType = requestedType;
      const activity = await queue.add(
        () => generateActivity(llm, logger, requestedType),
        { priority: "background", bucketKey: "activity" },
      );
      if (!activity) return;
      client.user.setActivity(activity.name, { type: activity.type });
      logger.debug({ activity }, "updated Discord activity");
    } catch (error) {
      logger.warn(
        { error, intervalMs: config.activityUpdateIntervalMs },
        "failed to update Discord activity",
      );
    } finally {
      inFlight = false;
    }
  };

  void update();
  const interval = setInterval(update, config.activityUpdateIntervalMs);
  interval.unref();
}

async function generateActivity(
  llm: LlmClient,
  logger: Logger,
  requestedType: ActivityKind,
): Promise<GeneratedActivity> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ACTIVITY_TIMEOUT_MS);

  try {
    const response = await llm.complete({
      messages: buildActivityMessages(requestedType),
      temperature: 0.9,
      maxTokens: 80,
      enableThinking: false,
      signal: controller.signal,
    });
    const activity = parseActivity(response.content, requestedType) ?? {
      ...DEFAULT_ACTIVITY,
      type: requestedType,
    };
    logger.debug(
      {
        rawContent: response.content,
        reasoningContentLength: response.reasoningContent?.length ?? 0,
        finishReason: response.finishReason,
        activity,
        timings: response.timings,
      },
      "generated Discord activity",
    );
    return activity;
  } finally {
    clearTimeout(timeout);
  }
}

function chooseActivityType(previous: ActivityKind | undefined): ActivityKind {
  const candidates = ACTIVITY_TYPES.filter((type) => type !== previous);
  return (
    candidates[Math.floor(Math.random() * candidates.length)] ??
    DEFAULT_ACTIVITY.type
  );
}

function parseActivity(
  content: string,
  requestedType: ActivityKind,
): GeneratedActivity | undefined {
  const json = extractJsonObject(content);
  if (!json) return undefined;

  try {
    const parsed = JSON.parse(json) as { type?: unknown; name?: unknown };
    const type = parseActivityType(parsed.type) ?? requestedType;

    const name = sanitizeActivityName(parsed.name);
    if (!name) return undefined;

    return { type: type === requestedType ? type : requestedType, name };
  } catch {
    return undefined;
  }
}

function extractJsonObject(content: string): string | undefined {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return undefined;
  return content.slice(start, end + 1);
}

function parseActivityType(value: unknown): ActivityKind | undefined {
  if (typeof value === "number" && ALLOWED_ACTIVITY_TYPES.has(value)) {
    return value;
  }

  if (typeof value === "string" && value in LEGACY_ACTIVITY_TYPES) {
    return LEGACY_ACTIVITY_TYPES[value as keyof typeof LEGACY_ACTIVITY_TYPES];
  }

  return undefined;
}

function sanitizeActivityName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const sanitized = stripUnicodeEmoji(value)
    .replaceAll(/[\r\n@#"`<>]/g, " ")
    .replaceAll(/https?:\/\/\S+/gi, "")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ACTIVITY_NAME_LENGTH)
    .trim();

  return sanitized || undefined;
}
