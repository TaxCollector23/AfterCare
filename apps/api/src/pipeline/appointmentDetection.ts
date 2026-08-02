import type { Appointment } from "@discharge-guide/shared-types";
import { grounded } from "./types.js";

export async function detectAppointments(_text: string) {
  return grounded<Appointment[]>([], 0, [], true);
}
