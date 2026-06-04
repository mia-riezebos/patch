import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../logger.js";
import {
  DiscordPronounProvider,
  extractPronounsPagePronouns,
} from "./pronouns.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("extractPronounsPagePronouns", () => {
  it("returns yes and okay pronoun sets as a comma separated list", () => {
    expect(
      extractPronounsPagePronouns({
        profiles: [
          {
            pronouns: [
              { value: "she/her", opinion: "yes" },
              { value: "they/them", opinion: "okay" },
              { value: "he/him", opinion: "no" },
            ],
          },
        ],
      }),
    ).toBe("she/her, they/them");
  });

  it("treats Pronouns.page meh as okay", () => {
    expect(
      extractPronounsPagePronouns({
        profiles: [
          {
            locale: "en",
            pronouns: [
              { value: "she", opinion: "yes" },
              { value: "they", opinion: "meh" },
              { value: ":mia", opinion: "meh" },
              { value: "he", opinion: "no" },
            ],
          },
          {
            locale: "nl",
            pronouns: [
              { value: "zij", opinion: "yes" },
              { value: "hen", opinion: "meh" },
            ],
          },
        ],
      }),
    ).toBe("she/her, they/them, mia/mia's");
  });

  it("does not fall back to nope pronouns", () => {
    expect(
      extractPronounsPagePronouns({
        profiles: [
          {
            pronouns: [{ value: "he/him", opinion: "no" }],
          },
        ],
      }),
    ).toBe(undefined);
  });

  it("deduplicates aliases", () => {
    expect(
      extractPronounsPagePronouns({
        profiles: [
          {
            pronouns: [
              { value: "she", opinion: "yes" },
              { value: "she/her", opinion: "okay" },
            ],
          },
        ],
      }),
    ).toBe("she/her");
  });
});

describe("DiscordPronounProvider", () => {
  it("marks missing pronouns instead of falling back to they/them", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}));
    globalThis.fetch = fetchMock;

    const provider = new DiscordPronounProvider("token", createLogger(false));

    await expect(provider.getPronouns("user", "guild")).resolves.toBe(
      "missing",
    );
  });
});

function jsonResponse(value: unknown): Response {
  return {
    ok: true,
    json: async () => value,
  } as Response;
}
