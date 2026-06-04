import type { Logger } from "../logger.js";
import type { LlmClient } from "./client.js";

const DEFAULT_MODEL_CACHE_TTL_MS = 5 * 60 * 1000;

export class ModelCatalog {
  private models: string[] = [];
  private expiresAt = 0;
  private refreshPromise: Promise<string[]> | undefined;

  constructor(
    private readonly llm: LlmClient,
    private readonly logger: Logger,
    private readonly cacheTtlMs = DEFAULT_MODEL_CACHE_TTL_MS,
  ) {}

  async getModels(): Promise<string[]> {
    if (this.isFresh()) return this.models;

    if (this.models.length > 0) {
      void this.refresh().catch((error) => {
        this.logger.warn({ error }, "failed to refresh model catalog");
      });
      return this.models;
    }

    return this.refresh();
  }

  async refresh(): Promise<string[]> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.llm
      .listModels()
      .then((models) => {
        this.models = models;
        this.expiresAt = Date.now() + this.cacheTtlMs;
        this.logger.debug({ models }, "refreshed model catalog");
        return models;
      })
      .finally(() => {
        this.refreshPromise = undefined;
      });

    return this.refreshPromise;
  }

  private isFresh(): boolean {
    return this.models.length > 0 && this.expiresAt > Date.now();
  }
}
