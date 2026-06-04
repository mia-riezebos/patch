import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const promptCache = new Map<string, string>();

export function readPromptFile(filename: string): string {
  const cached = promptCache.get(filename);
  if (cached !== undefined) return cached;

  const prompt = readFileSync(
    resolve(process.cwd(), "prompts", filename),
    "utf8",
  ).trim();
  promptCache.set(filename, prompt);
  return prompt;
}

export function reloadPromptFiles(): number {
  const count = promptCache.size;
  promptCache.clear();
  return count;
}
