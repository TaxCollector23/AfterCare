import { grounded } from "./types.js";

export async function runOcr(_bytes: Buffer) {
  // Placeholder until an OCR provider is selected. It deliberately returns no
  // invented clinical content.
  return grounded({ text: "", lineCount: 0 }, 0, [], true);
}
