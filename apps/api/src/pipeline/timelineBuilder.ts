import type { TimelineItem } from "@discharge-guide/shared-types";
import { grounded } from "./types.js";

export async function buildTimeline(_text: string) {
  return grounded<TimelineItem[]>([], 0, [], true);
}
