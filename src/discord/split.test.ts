import { describe, expect, it } from "vitest";
import { needsSplitHintRepair, splitDiscordResponse } from "./split.js";

describe("splitDiscordResponse", () => {
  it("preserves unstructured line breaks without explicit split hints", () => {
    expect(splitDiscordResponse("first\nsecond\n\nthird")).toEqual([
      "first\nsecond\n\nthird",
    ]);
  });

  it("detects casual multiline replies that need explicit split repair", () => {
    expect(needsSplitHintRepair("first\nsecond\n\nthird")).toBe(true);
  });

  it("does not request split repair for structured markdown", () => {
    expect(needsSplitHintRepair("- first\n- second")).toBe(false);
  });

  it("does not request split repair for long lines", () => {
    expect(needsSplitHintRepair(`${"x".repeat(181)}\nshort`)).toBe(false);
  });

  it("does not request split repair for many lines", () => {
    expect(needsSplitHintRepair("one\ntwo\nthree\nfour\nfive")).toBe(false);
  });

  it("requests split repair for short four-line casual bursts", () => {
    expect(needsSplitHintRepair("one\ntwo\nthree\nfour")).toBe(true);
  });

  it("preserves heading-structured markdown", () => {
    expect(splitDiscordResponse("## plan\nfirst<split />\nsecond")).toEqual([
      "## plan\nfirst\n\nsecond",
    ]);
  });

  it("preserves list-structured markdown", () => {
    expect(splitDiscordResponse("- first<split />\n- second")).toEqual([
      "- first\n\n- second",
    ]);
  });

  it("preserves blockquotes", () => {
    expect(splitDiscordResponse("> first<split />\n> second")).toEqual([
      "> first\n\n> second",
    ]);
  });

  it("preserves fenced code blocks", () => {
    expect(
      splitDiscordResponse(
        "```ts\nconst x = '<split />';\nconsole.log(x);\n```",
      ),
    ).toEqual(["```ts\nconst x = '<split />';\nconsole.log(x);\n```"]);
  });

  it("normalizes explicit split hints", () => {
    expect(splitDiscordResponse("first\n\n<split />\n\nsecond")).toEqual([
      "first",
      "second",
    ]);
  });

  it("splits inline explicit split hints", () => {
    expect(splitDiscordResponse("first<split />second<split />third")).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("caps burst count by distributing explicit split chunks evenly", () => {
    expect(
      splitDiscordResponse(
        "1<split />2<split />3<split />4<split />5<split />6<split />7<split />8<split />9",
      ),
    ).toEqual(["1\n2", "3\n4", "5\n6", "7", "8", "9"]);
  });
});
