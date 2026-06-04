import { describe, expect, it, vi } from "vitest";
import type { Logger } from "../logger.js";
import type { LlmClient } from "./client.js";
import { ModelCatalog } from "./model-catalog.js";

describe("ModelCatalog", () => {
  it("caches model list results", async () => {
    const llm = {
      listModels: vi.fn().mockResolvedValue(["qwen3-8b", "gemma-4-e4b-it"]),
    } as unknown as LlmClient;
    const catalog = new ModelCatalog(llm, logger(), 60_000);

    await expect(catalog.getModels()).resolves.toEqual([
      "qwen3-8b",
      "gemma-4-e4b-it",
    ]);
    await expect(catalog.getModels()).resolves.toEqual([
      "qwen3-8b",
      "gemma-4-e4b-it",
    ]);

    expect(llm.listModels).toHaveBeenCalledTimes(1);
  });

  it("returns stale models while refreshing expired cache", async () => {
    const llm = {
      listModels: vi
        .fn()
        .mockResolvedValueOnce(["old-model"])
        .mockResolvedValueOnce(["new-model"]),
    } as unknown as LlmClient;
    const catalog = new ModelCatalog(llm, logger(), 1);

    await expect(catalog.getModels()).resolves.toEqual(["old-model"]);
    await new Promise((resolve) => setTimeout(resolve, 2));
    await expect(catalog.getModels()).resolves.toEqual(["old-model"]);
    await vi.waitFor(() => expect(llm.listModels).toHaveBeenCalledTimes(2));
    await expect(catalog.getModels()).resolves.toEqual(["new-model"]);
  });
});

function logger(): Logger {
  return {
    debug: vi.fn(),
    warn: vi.fn(),
  } as unknown as Logger;
}
