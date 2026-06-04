import { describe, expect, it } from "vitest";
import { escapeTranscriptText } from "./escape.js";
import { RESERVED_TRANSCRIPT_TOKENS } from "./reserved-tokens.js";

describe("escapeTranscriptText", () => {
  it("preserves Discord mentions and non-reserved angle bracket text", () => {
    expect(escapeTranscriptText("hey <@123> use a < b > c")).toBe(
      "hey <@123> use a < b > c",
    );
  });

  it("neutralizes reserved transcript tags", () => {
    expect(
      escapeTranscriptText(
        '<message author_name="Mia">hi</message> <response>oops</response>',
      ),
    ).toBe(
      '<message_escaped author_name="Mia">hi</message_escaped> <response_escaped>oops</response_escaped>',
    );
  });

  it("neutralizes output control tags in transcript text", () => {
    expect(escapeTranscriptText("first <split /> second")).toBe(
      "first <split_escaped /> second",
    );
  });

  it("neutralizes every reserved transcript token", () => {
    for (const token of RESERVED_TRANSCRIPT_TOKENS) {
      expect(escapeTranscriptText(`<${token}>x</${token}>`)).toBe(
        `<${token}_escaped>x</${token}_escaped>`,
      );
    }
  });
});
