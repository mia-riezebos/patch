import type { LlmMessage } from "../llm/client.js";
import { readPromptFile } from "./files.js";

export type ClassifierPromptContext = {
  triggerKind: "passive_guild_message";
  location: "guild_channel" | "guild_thread";
  botUserId: string;
  latestMessage: {
    id: string;
    authorId: string;
    authorName: string;
    replyToMessageId?: string;
    userMentionCount: number;
    roleMentionCount: number;
    mentionsEveryone: boolean;
    attachmentCount: number;
  };
  channel: {
    id: string;
    type: string;
    name?: string;
  };
};

const COMMON_CLASSIFIER_PROMPT_FILES = [
  "system/identity.md",
  "system/transcript.md",
  "system/humor.md",
  "system/slang-policy.md",
  "classifier.md",
];

const CLASSIFIER_MODE_PROMPT_FILES = {
  guild_channel: "system/transcript-global.md",
  guild_thread: "system/transcript-thread.md",
} satisfies Record<ClassifierPromptContext["location"], string>;

export function buildClassifierMessages(
  transcript: string,
  context: ClassifierPromptContext,
): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        ...COMMON_CLASSIFIER_PROMPT_FILES.map(readPromptFile),
        readPromptFile(CLASSIFIER_MODE_PROMPT_FILES[context.location]),
      ].join("\n\n"),
    },
    {
      role: "user",
      content: readPromptFile("classifier-user.md")
        .replace("{{context}}", JSON.stringify(context, null, 2))
        .replace("{{transcript}}", transcript),
    },
  ];
}
