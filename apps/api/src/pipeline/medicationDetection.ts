import type { Medication } from "@discharge-guide/shared-types";
import { grounded } from "./types.js";

export async function detectMedications(_text: string) {
  return grounded<Medication[]>([], 0, [], true);
}
