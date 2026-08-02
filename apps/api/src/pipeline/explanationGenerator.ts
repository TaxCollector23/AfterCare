import { grounded } from "./types.js";

export async function generateExplanations(_terms: string[]) {
  return grounded<Record<string, string>>({}, 0, [], true);
}
