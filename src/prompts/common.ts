export const RESPONSE_RULE_PROMPT_FILES = [
  "system/01-role.md",
  "system/02-identity.md",
  "system/03-participant-relations.md",
  "system/06-output.md",
  "system/07-safety.md",
  "system/08-style.md",
  "system/09-humour.md",
  "system/10-slang-policy.md",
  "webslang/phrases.md",
  "system/11-helpfulness.md",
  "system/12-splitting.md",
  "system/13-mentions.md",
];

export const RESPONSE_TRANSCRIPT_PREFIX_PROMPT_FILES = [
  "system/01-role.md",
  "system/02-identity.md",
  "system/03-participant-relations.md",
  "system/04-transcript.md",
];

export const RESPONSE_TRANSCRIPT_SUFFIX_PROMPT_FILES = [
  "system/06-output.md",
  "system/07-safety.md",
  "system/08-style.md",
  "system/09-humour.md",
  "system/10-slang-policy.md",
  "webslang/phrases.md",
  "system/11-helpfulness.md",
  "system/12-splitting.md",
  "system/13-mentions.md",
];

export const RESPONSE_TRANSCRIPT_PROMPT_FILES = [
  ...RESPONSE_TRANSCRIPT_PREFIX_PROMPT_FILES,
  ...RESPONSE_TRANSCRIPT_SUFFIX_PROMPT_FILES,
];
