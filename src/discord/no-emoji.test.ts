import { describe, expect, it } from "vitest";
import { stripUnicodeEmoji } from "./no-emoji.js";

describe("stripUnicodeEmoji", () => {
  it("removes unicode emoji", () => {
    expect(stripUnicodeEmoji("imma stop 😭")).toBe("imma stop");
  });

  it("keeps text smileys", () => {
    expect(stripUnicodeEmoji("hehe :3")).toBe("hehe :3");
  });

  it("cleans spaces before newlines", () => {
    expect(stripUnicodeEmoji("one 🫡\ntwo")).toBe("one\ntwo");
  });
});
