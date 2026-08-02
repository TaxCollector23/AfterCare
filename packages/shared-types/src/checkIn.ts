/**
 * Traffic-light daily check-in.
 *
 * The patient picks one option per question and the severity is exactly the
 * option they picked — there is no inference step, no model call, and no risk
 * prediction. `overallCheckInLevel` is a max over the answers, so the result
 * can never be more severe than something the patient actually reported.
 */

export type CheckInLevel = "green" | "orange" | "red";

export type CheckInQuestionId = "pain" | "wound" | "condition";

/** Least to most concerning. Used to pick the worst answer given. */
const LEVEL_SEVERITY: Record<CheckInLevel, number> = {
  green: 0,
  orange: 1,
  red: 2,
};

export interface CheckInOption {
  level: CheckInLevel;
  label: string;
}

export interface CheckInQuestion {
  id: CheckInQuestionId;
  prompt: string;
  /** Noun phrase for use mid-sentence, where the question form reads wrong. */
  subject: string;
  /** Exactly one option per level, ordered green -> orange -> red. */
  options: CheckInOption[];
}

/**
 * The questions themselves are fixed, generic post-op monitoring prompts — not
 * derived from the document and not personalised. They describe how the patient
 * feels; they never assert anything about their condition.
 */
export const CHECK_IN_QUESTIONS: CheckInQuestion[] = [
  {
    id: "pain",
    prompt: "How is your pain today?",
    subject: "your pain",
    options: [
      { level: "green", label: "Manageable, or no worse than yesterday" },
      { level: "orange", label: "Worse than yesterday, or my usual relief isn't helping" },
      { level: "red", label: "Severe, sudden, or unbearable" },
    ],
  },
  {
    id: "wound",
    prompt: "How does your wound or surgical site look?",
    subject: "your wound or surgical site",
    options: [
      { level: "green", label: "Clean and dry, healing as expected" },
      { level: "orange", label: "More red, swollen, or leaking than before" },
      { level: "red", label: "Opening up, bleeding, or smells bad" },
    ],
  },
  {
    id: "condition",
    prompt: "How are you feeling overall?",
    subject: "how you are feeling overall",
    options: [
      { level: "green", label: "About as expected for my recovery" },
      { level: "orange", label: "Off — more tired, dizzy, or unwell than expected" },
      { level: "red", label: "Very unwell — fever, chills, or trouble breathing" },
    ],
  },
];

export type CheckInAnswers = Partial<Record<CheckInQuestionId, CheckInLevel>>;

export interface CheckInRecord {
  id: string;
  documentId: string;
  answers: CheckInAnswers;
  overall: CheckInLevel;
  createdAt: number;
  /**
   * When the patient marked a concerning check-in as dealt with. A red or
   * orange check-in counts as "unresolved" until this is set, which is what the
   * follow-up priority on the dashboard reads.
   */
  acknowledgedAt?: number | null;
  /** Care-circle addresses the alert was recorded against. */
  notifiedEmails: string[];
}

/** True once every question has an answer. */
export function isCheckInComplete(answers: CheckInAnswers): boolean {
  return CHECK_IN_QUESTIONS.every((question) => answers[question.id] != null);
}

/**
 * The worst level the patient reported. Returns green for an empty check-in:
 * absence of an answer is not evidence of a problem.
 */
export function overallCheckInLevel(answers: CheckInAnswers): CheckInLevel {
  let worst: CheckInLevel = "green";
  for (const question of CHECK_IN_QUESTIONS) {
    const level = answers[question.id];
    if (level && LEVEL_SEVERITY[level] > LEVEL_SEVERITY[worst]) worst = level;
  }
  return worst;
}

/** Orange and red both warrant telling the care circle; green does not. */
export function shouldAlertCaregivers(level: CheckInLevel): boolean {
  return level === "orange" || level === "red";
}

/** The questions whose answer matches the overall level — the ones that drove it. */
export function drivingQuestions(answers: CheckInAnswers): CheckInQuestion[] {
  const overall = overallCheckInLevel(answers);
  if (overall === "green") return [];
  return CHECK_IN_QUESTIONS.filter((q) => answers[q.id] === overall);
}

export const LEVEL_LABEL: Record<CheckInLevel, string> = {
  green: "Doing well",
  orange: "Keep an eye on this",
  red: "Needs attention now",
};

/** Maps a level onto the existing .tag- helper classes. */
export const LEVEL_TAG_CLASS: Record<CheckInLevel, string> = {
  green: "tag-low",
  orange: "tag-med",
  red: "tag-high",
};

/** A check-in still counts against follow-up priority until acknowledged. */
export function isUnresolved(record: CheckInRecord): boolean {
  return record.overall !== "green" && !record.acknowledgedAt;
}
