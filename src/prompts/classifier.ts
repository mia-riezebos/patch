import type { LlmMessage } from "../llm/client.js";
import { readPromptFile } from "./files.js";

export type ClassifierPromptContext = {
  triggerKind: "dm_message" | "passive_guild_message";
  location: "dm" | "guild_channel" | "guild_thread";
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

const COMMON_CLASSIFIER_PREFIX_PROMPT_FILES = [
  "system/01-role.md",
  "system/02-identity.md",
  "system/03-participant-relations.md",
  "system/04-transcript.md",
];

const COMMON_CLASSIFIER_SUFFIX_PROMPT_FILES = [
  "system/09-tone.md",
  "system/10-humour.md",
  "system/11-slang-policy.md",
  "webslang/phrases.md",
  "20-classifier.md",
];

const CLASSIFIER_MODE_PROMPT_FILES = {
  dm: "system/05-transcript-dm.md",
  guild_channel: "system/05-transcript-global.md",
  guild_thread: "system/05-transcript-thread.md",
} satisfies Record<ClassifierPromptContext["location"], string>;

export function buildClassifierMessages(
  transcript: string,
  context: ClassifierPromptContext,
): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        ...COMMON_CLASSIFIER_PREFIX_PROMPT_FILES.map(readPromptFile),
        readPromptFile(CLASSIFIER_MODE_PROMPT_FILES[context.location]),
        ...COMMON_CLASSIFIER_SUFFIX_PROMPT_FILES.map(readPromptFile),
      ].join("\n\n"),
    },
    {
      role: "user",
      content: readPromptFile("21-classifier-user.md")
        .replace("{{context}}", JSON.stringify(context, null, 2))
        .replace("{{transcript}}", transcript),
    },
  ];
}
