import {
  RESPONSE_TRANSCRIPT_PREFIX_PROMPT_FILES,
  RESPONSE_TRANSCRIPT_SUFFIX_PROMPT_FILES,
} from "./common.js";
import { readPromptFile } from "./files.js";

export type ResponseTranscriptMode = "dm" | "global" | "thread";

const MODE_PROMPT_FILES: Record<ResponseTranscriptMode, string> = {
  dm: "system/05-transcript-dm.md",
  global: "system/05-transcript-global.md",
  thread: "system/05-transcript-thread.md",
};

export function buildResponseMessages(
  transcript: string,
  mode: ResponseTranscriptMode,
  availableActionsPrompt = "",
) {
  const systemPromptFiles = [
    ...RESPONSE_TRANSCRIPT_PREFIX_PROMPT_FILES,
    MODE_PROMPT_FILES[mode],
    ...RESPONSE_TRANSCRIPT_SUFFIX_PROMPT_FILES,
  ];
  const systemPrompt = [
    systemPromptFiles.map(readPromptFile).join("\n\n"),
    availableActionsPrompt,
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    { role: "system" as const, content: systemPrompt },
    {
      role: "user" as const,
      content: readPromptFile("40-response-user.md").replace(
        "{{transcript}}",
        transcript,
      ),
    },
  ];
}
