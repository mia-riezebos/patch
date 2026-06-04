const DISCORD_MESSAGE_LIMIT = 2000;
const SAFE_MESSAGE_LIMIT = 1900;
const SPLIT_HINT = "<split />";
const SPLIT_HINT_PATTERN = /<split\s*\/?>/gi;
const MAX_RESPONSE_MESSAGES = 6;

export function splitDiscordResponse(content: string): string[] {
  const normalized = normalizeSplitHints(content.trim());
  const splitCandidates = hasProtectedMarkdown(normalized)
    ? [removeSplitHintsOutsideCodeFences(normalized)]
    : splitOnHints(normalized);
  const chunks = splitCandidates
    .flatMap((chunk) => splitHardLimit(chunk.trim()))
    .filter(Boolean);
  return capResponseMessages(chunks);
}

function normalizeSplitHints(content: string): string {
  return content.replace(SPLIT_HINT_PATTERN, SPLIT_HINT);
}

function hasProtectedMarkdown(content: string): boolean {
  return (
    hasMarkdownHeading(content) ||
    hasMarkdownList(content) ||
    hasBlockquote(content) ||
    hasCodeFence(content)
  );
}

function hasMarkdownHeading(content: string): boolean {
  return /^#{1,6}\s+\S/m.test(content);
}

function hasMarkdownList(content: string): boolean {
  return /^(?:\s*[-*+]\s+\S|\s*\d+[.)]\s+\S)/m.test(content);
}

function hasBlockquote(content: string): boolean {
  return /^>\s?\S/m.test(content);
}

function hasCodeFence(content: string): boolean {
  return /^```/m.test(content);
}

function removeSplitHintsOutsideCodeFences(content: string): string {
  let inFence = false;
  return content
    .split("\n")
    .map((line) => {
      if (line.trim().startsWith("```")) inFence = !inFence;
      return inFence ? line : line.replaceAll(SPLIT_HINT, "\n");
    })
    .join("\n");
}

function capResponseMessages(chunks: string[]): string[] {
  if (chunks.length <= MAX_RESPONSE_MESSAGES) return chunks;

  return groupEvenly(chunks, MAX_RESPONSE_MESSAGES).map((group) => {
    const [firstChunk, ...overflow] = splitHardLimit(group.join("\n"));
    if (!firstChunk) return "";
    if (overflow.length === 0) return firstChunk;
    return appendOmissionMarker(firstChunk, overflow.length);
  });
}

function groupEvenly(chunks: string[], groupCount: number): string[][] {
  const groups: string[][] = [];
  let index = 0;

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const remainingChunks = chunks.length - index;
    const remainingGroups = groupCount - groupIndex;
    const size = Math.ceil(remainingChunks / remainingGroups);
    groups.push(chunks.slice(index, index + size));
    index += size;
  }

  return groups;
}

function appendOmissionMarker(content: string, omitted: number): string {
  const marker = `\n… ${omitted} more message chunks omitted`;
  if (content.length + marker.length <= SAFE_MESSAGE_LIMIT) {
    return `${content}${marker}`;
  }

  return `${content.slice(0, SAFE_MESSAGE_LIMIT - marker.length).trim()}${marker}`;
}

function splitOnHints(content: string): string[] {
  const chunks: string[] = [];
  let current = "";
  let inFence = false;

  for (const line of content.split("\n")) {
    if (line.trim().startsWith("```")) inFence = !inFence;

    if (inFence) {
      current = appendLine(current, line);
      continue;
    }

    const parts = line.split(SPLIT_HINT);
    const [firstPart, ...splitParts] = parts;
    current = appendLine(current, firstPart ?? "");

    for (const part of splitParts) {
      chunks.push(current.trim());
      current = part;
    }
  }

  chunks.push(current.trim());
  return chunks;
}

function appendLine(current: string, line: string): string {
  return current ? `${current}\n${line}` : line;
}

function splitHardLimit(content: string): string[] {
  if (content.length <= SAFE_MESSAGE_LIMIT) return [content];

  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > SAFE_MESSAGE_LIMIT) {
    const splitAt = findSplitIndex(remaining);
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

function findSplitIndex(content: string): number {
  const search = content.slice(0, SAFE_MESSAGE_LIMIT);
  const paragraph = search.lastIndexOf("\n\n");
  if (paragraph > 500) return paragraph;

  const newline = search.lastIndexOf("\n");
  if (newline > 500) return newline;

  const sentence = Math.max(
    search.lastIndexOf(". "),
    search.lastIndexOf("! "),
    search.lastIndexOf("? "),
  );
  if (sentence > 500) return sentence + 1;

  const space = search.lastIndexOf(" ");
  if (space > 500) return space;

  return Math.min(SAFE_MESSAGE_LIMIT, DISCORD_MESSAGE_LIMIT);
}
