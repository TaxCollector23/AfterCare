import type { WarningSign } from "@discharge-guide/shared-types";
import { grounded } from "./types.js";

export async function detectWarnings(_text: string) {
  return grounded<WarningSign[]>([], 0, [], true);
}
