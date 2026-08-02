import { grounded } from "./types.js";

export async function extractMedicalInformation(_text: string) {
  return grounded({ sections: [], terms: [] }, 0, [], true);
}
