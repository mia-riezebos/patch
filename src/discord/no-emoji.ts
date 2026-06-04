const EMOJI_PATTERN =
  /(?:\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F|\uFE0E)?)*)/gu;
const EXTRA_EMOJI_PATTERN = /(?:\p{Regional_Indicator}|\p{Emoji_Modifier})/gu;

export function stripUnicodeEmoji(content: string): string {
  return content
    .replace(EMOJI_PATTERN, "")
    .replace(EXTRA_EMOJI_PATTERN, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/ {2,}/g, " ")
    .trim();
}
