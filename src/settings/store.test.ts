import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsStore } from "./store.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("SettingsStore", () => {
  it("seeds the LLM model from config", () => {
    const store = new SettingsStore(":memory:", { llmModel: "gemma-4-e4b-it" });

    expect(store.getLlmModel()).toBe("gemma-4-e4b-it");

    store.close();
  });

  it("persists LLM model changes", () => {
    const dir = mkdtempSync(join(tmpdir(), "patch-settings-"));
    tempDirs.push(dir);
    const path = join(dir, "patch.sqlite");

    const first = new SettingsStore(path, { llmModel: "gemma-4-e4b-it" });
    first.setLlmModel("gemma-4-e4b-it");
    first.close();

    const second = new SettingsStore(path, { llmModel: "gemma-4-e4b-it" });
    expect(second.getLlmModel()).toBe("gemma-4-e4b-it");
    second.close();
  });
});
