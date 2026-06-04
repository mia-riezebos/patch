import { getBotIdentity } from "../identity.js";
import type { LlmMessage } from "../llm/client.js";
import { readPromptFile } from "./files.js";

export function buildActivityMessages(activityType: number): LlmMessage[] {
  return [
    { role: "system", content: readPromptFile("00-activity.md") },
    {
      role: "user",
      content: `Generate one fresh ${getBotIdentity().name} activity now. Use Activity type ${activityType}.`,
    },
  ];
}
