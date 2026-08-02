/**
 * Progress model for the document-processing bar.
 *
 * The bar is driven by the pipeline's real SSE stage events, not a timer. Each
 * stage carries a weight roughly proportional to how long it actually takes
 * (OCR dominates; the detection stages are quick), so the bar moves in
 * proportion to work done rather than in equal jumps.
 *
 * `percent` deliberately never reaches 100 while work is outstanding — the bar
 * hits 100 only when the pipeline reports completion, so it can't sit full
 * while the user waits.
 */
import type { PipelineStage } from "./index.js";

/** Execution order, matching runPipeline in apps/api/src/pipeline/index.ts. */
export const PIPELINE_STAGE_ORDER: PipelineStage[] = [
  "ocr",
  "extract",
  "meds",
  "appts",
  "warnings",
  "timeline",
  "explain",
  "judge",
];

/** Relative cost per stage. Sums to 100. */
export const PIPELINE_STAGE_WEIGHT: Record<PipelineStage, number> = {
  ocr: 30,
  extract: 14,
  meds: 10,
  appts: 8,
  warnings: 8,
  timeline: 8,
  explain: 12,
  judge: 10,
};

export const PIPELINE_STAGE_LABEL: Record<PipelineStage, string> = {
  ocr: "Reading the text on your document",
  extract: "Sorting it into sections",
  meds: "Finding your medications",
  appts: "Finding your appointments",
  warnings: "Finding your warning signs",
  timeline: "Building your recovery timeline",
  explain: "Explaining the medical terms",
  judge: "Double-checking every detail",
};

/** Fraction of a stage's weight credited once it has started but not finished. */
const IN_FLIGHT_CREDIT = 0.5;

/** Highest percent reachable before the pipeline reports completion. */
export const MAX_IN_PROGRESS_PERCENT = 99;

export interface PipelineProgress {
  percent: number;
  /** What to show under the bar right now. */
  label: string;
  completedStages: number;
  totalStages: number;
}

const TOTAL_WEIGHT = PIPELINE_STAGE_ORDER.reduce(
  (sum, stage) => sum + PIPELINE_STAGE_WEIGHT[stage],
  0,
);

export interface PipelineProgressInput {
  /** Stages that reported done or error — both are finished work. */
  completed: readonly PipelineStage[];
  /** The stage currently running, if any. */
  current?: PipelineStage | null;
  /** Set once the pipeline emits its terminal completion event. */
  finished?: boolean;
}

/**
 * Progress for a set of observed stage events.
 *
 * Unknown or duplicated stage names are ignored rather than inflating the bar,
 * since the events come off the wire.
 */
export function pipelineProgress(
  input: PipelineProgressInput,
): PipelineProgress {
  const known = new Set(PIPELINE_STAGE_ORDER);
  const completed = new Set(
    input.completed.filter((stage) => known.has(stage)),
  );

  if (input.finished) {
    return {
      percent: 100,
      label: "Your guide is ready",
      completedStages: PIPELINE_STAGE_ORDER.length,
      totalStages: PIPELINE_STAGE_ORDER.length,
    };
  }

  let weight = 0;
  for (const stage of completed) weight += PIPELINE_STAGE_WEIGHT[stage];

  const current =
    input.current && known.has(input.current) && !completed.has(input.current)
      ? input.current
      : null;
  if (current) weight += PIPELINE_STAGE_WEIGHT[current] * IN_FLIGHT_CREDIT;

  const percent = Math.min(
    MAX_IN_PROGRESS_PERCENT,
    Math.round((weight / TOTAL_WEIGHT) * 100),
  );

  // Prefer the running stage's label; fall back to the next one queued so the
  // caption is never blank before the first event arrives.
  const next = PIPELINE_STAGE_ORDER.find((stage) => !completed.has(stage));
  const label = current
    ? PIPELINE_STAGE_LABEL[current]
    : next
      ? PIPELINE_STAGE_LABEL[next]
      : "Finishing up";

  return {
    percent,
    label,
    completedStages: completed.size,
    totalStages: PIPELINE_STAGE_ORDER.length,
  };
}
