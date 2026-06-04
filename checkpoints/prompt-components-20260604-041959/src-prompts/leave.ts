import type { LlmMessage } from "../llm/client.js";
import { RESPONSE_TRANSCRIPT_PROMPT_FILES } from "./common.js";
import { readPromptFile } from "./files.js";

type LeaveRequester = {
  id: string;
  name: string;
};

export function buildLeaveMessages(
  requester: LeaveRequester,
  transcript: string,
): LlmMessage[] {
  const leavePrompt = readPromptFile("leave.md").replace(
    "{{requested_by}}",
    `${requester.name} (${requester.id})`,
  );

  return [
    {
      role: "system",
      content: [
        ...RESPONSE_TRANSCRIPT_PROMPT_FILES.map(readPromptFile),
        leavePrompt,
        readPromptFile("system/transcript-thread.md"),
      ].join("\n\n"),
    },
    {
      role: "user",
      content: readPromptFile("leave-user.md").replace(
        "{{transcript}}",
        transcript,
      ),
    },
  ];
}
