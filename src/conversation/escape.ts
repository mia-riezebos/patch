import { RESERVED_TRANSCRIPT_TOKENS } from "./reserved-tokens.js";

export function escapeTranscriptText(value: string): string {
  return neutralizeReservedTranscriptTokens(value);
}

export function escapeAttribute(value: string): string {
  return escapeXml(value).replace(/\n/g, "&#10;").replace(/\r/g, "&#13;");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function neutralizeReservedTranscriptTokens(value: string): string {
  let escaped = value;

  for (const token of RESERVED_TRANSCRIPT_TOKENS) {
    escaped = escaped.replace(
      new RegExp(`<(\\s*/?\\s*)${token}(?=[\\s>/])`, "gi"),
      `<$1${token}_escaped`,
    );
  }

  return escaped;
}
