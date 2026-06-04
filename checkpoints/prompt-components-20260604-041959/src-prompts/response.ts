import { RESPONSE_TRANSCRIPT_PROMPT_FILES } from "./common.js";
import { readPromptFile } from "./files.js";

export type ResponseTranscriptMode = "dm" | "global" | "thread";

const MODE_PROMPT_FILES: Record<ResponseTranscriptMode, string> = {
  dm: "system/transcript-dm.md",
  global: "system/transcript-global.md",
  thread: "system/transcript-thread.md",
};

export function buildResponseMessages(
  transcript: string,
  mode: ResponseTranscriptMode,
  options: { enableThinking?: boolean } = {},
) {
  const systemPromptFiles = [
    ...RESPONSE_TRANSCRIPT_PROMPT_FILES,
    ...(options.enableThinking ? ["system/reasoning.md"] : []),
    MODE_PROMPT_FILES[mode],
  ];
  const systemPrompt = systemPromptFiles.map(readPromptFile).join("\n\n");

  return [
    { role: "system" as const, content: systemPrompt },
    {
      role: "user" as const,
      content: readPromptFile("response-user.md").replace(
        "{{transcript}}",
        transcript,
      ),
    },
  ];
}
