import type { LlmMessage } from "../llm/client.js";
import { readPromptFile } from "./files.js";

export function buildActivityMessages(activityType: number): LlmMessage[] {
  return [
    { role: "system", content: readPromptFile("activity.md") },
    {
      role: "user",
      content: `Generate one fresh Patch activity now. Use Activity type ${activityType}.`,
    },
  ];
}
