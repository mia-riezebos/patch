import { describe, expect, it, vi } from "vitest";
import type { Logger } from "../logger.js";
import { askLlm } from "./ask.js";
import type { LlmClient } from "./client.js";

describe("askLlm", () => {
  it("passes selected tools and tool choice through to the LLM client", async () => {
    const llm = {
      complete: vi.fn().mockResolvedValue({
        content: "",
        finishReason: "tool_calls",
        toolCalls: [
          {
            type: "function",
            name: "create_reminder",
            arguments: '{"title":"feed dragons"}',
          },
        ],
      }),
    } as unknown as LlmClient;
    const tools = [
      {
        type: "function" as const,
        function: {
          name: "create_reminder",
          description: "Create a reminder.",
          parameters: { type: "object" },
        },
      },
    ];

    const response = await askLlm({
      llm,
      logger: logger(),
      messages: [{ role: "user", content: "remind me" }],
      timeoutMs: 1_000,
      tools,
      toolChoice: "auto",
    });

    expect(response.toolCalls?.[0]?.name).toBe("create_reminder");
    expect(llm.complete).toHaveBeenCalledWith(
      expect.objectContaining({ tools, toolChoice: "auto" }),
    );
  });
});

function logger(): Logger {
  return {
    debug: vi.fn(),
  } as unknown as Logger;
}
