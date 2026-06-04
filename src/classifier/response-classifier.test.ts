import { describe, expect, it } from "vitest";
import { parseClassifierDecision } from "./response-classifier.js";

describe("parseClassifierDecision", () => {
  it("parses valid classifier JSON", () => {
    expect(
      parseClassifierDecision(
        '{"shouldRespond":true,"confidence":0.9,"reason":"banter"}',
      ),
    ).toEqual({
      valid: true,
      decision: { shouldRespond: true, confidence: 0.9, reason: "banter" },
    });
  });

  it("marks truncated JSON invalid", () => {
    expect(
      parseClassifierDecision(
        '{"shouldRespond":true,"confidence":0.9,"reason":"banter"',
      ),
    ).toEqual({
      valid: false,
      decision: { shouldRespond: false, confidence: 0, reason: "no json" },
    });
  });
});
