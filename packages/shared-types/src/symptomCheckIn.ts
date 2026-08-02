/**
 * Symptom check-in matching, shared by the API and the web app.
 *
 * A check-in can only ever select from the WarningSign entries the pipeline
 * extracted and the judge stage verified against the source document. There is
 * deliberately no free-text symptom input and no predictive model here: the
 * escalation decision is a lookup of the action the patient's own discharge
 * paperwork already prescribed for that symptom.
 */
import type { WarningSign } from "./index.js";

export type WarningAction = WarningSign["action"];

/**
 * Escalation order, least to most urgent. Used to pick the single strongest
 * instruction when a patient reports several symptoms at once.
 */
const ACTION_SEVERITY: Record<WarningAction, number> = {
  call_provider: 1,
  emergency_room: 2,
  call_911: 3,
};

/** Actions that warrant alerting the patient's care circle, not just the patient. */
export function escalatesToCaregiver(action: WarningAction): boolean {
  return action === "emergency_room" || action === "call_911";
}

export interface CheckInResult<T> {
  /** The selected signs, in the order the document listed them. */
  matched: T[];
  /**
   * Only the selected signs whose own action is `highestAction`.
   *
   * These are the ones that justify the instruction shown to the patient.
   * Attributing it to every selected symptom would tell them the document
   * prescribed a stronger action for a symptom than it actually did.
   */
  driving: T[];
  /** Selected ids that aren't warning signs in this document — always ignored. */
  unknownIds: string[];
  /** The single most urgent action across everything selected. */
  highestAction: WarningAction | null;
  /** True when the most urgent action calls for notifying the care circle. */
  shouldAlertCaregivers: boolean;
}

type MatchableWarning = Pick<WarningSign, "id" | "action">;

/**
 * Resolves a set of selected symptom ids against the document's warning signs.
 *
 * Ids that don't appear in the document are reported separately and never
 * influence the escalation — a check-in cannot manufacture an emergency for a
 * symptom the patient's paperwork never listed.
 */
export function evaluateCheckIn<T extends MatchableWarning>(
  warnings: readonly T[],
  selectedIds: readonly string[],
): CheckInResult<T> {
  const selected = new Set(selectedIds);
  const known = new Set(warnings.map((warning) => warning.id));

  const matched = warnings.filter((warning) => selected.has(warning.id));
  const unknownIds = [...selected].filter((id) => !known.has(id));

  let highestAction: WarningAction | null = null;
  for (const warning of matched) {
    if (
      highestAction === null ||
      ACTION_SEVERITY[warning.action] > ACTION_SEVERITY[highestAction]
    ) {
      highestAction = warning.action;
    }
  }

  return {
    matched,
    driving:
      highestAction === null
        ? []
        : matched.filter((warning) => warning.action === highestAction),
    unknownIds,
    highestAction,
    shouldAlertCaregivers:
      highestAction !== null && escalatesToCaregiver(highestAction),
  };
}

/** Patient-facing instruction text for each action the document can prescribe. */
export const ACTION_INSTRUCTION: Record<WarningAction, string> = {
  call_provider: "Call your provider",
  emergency_room: "Go to the emergency room",
  call_911: "Call emergency services",
};
