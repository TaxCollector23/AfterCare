/**
 * Stage 6: LLM judge — independent verification of structured findings.
 *
 * Detection stages are single-pass extractions. The judge re-reads the same
 * numbered source text and cross-checks every medication, appointment, and
 * warning against it, so a hallucinated finding (no textual support) never
 * reaches the patient.
 *
 * Verdicts:
 *   pass   -> keep the finding and its confidence.
 *   review -> keep the finding but cap confidence below the review threshold,
 *             which triggers the UI's "please check the original document"
 *             banner for that item.
 *   fail   -> drop the finding entirely. Unsupported clinical information is
 *             worse than missing information for a patient-facing app.
 *
 * The judge is a safety net, not a gate: if the judge call itself fails
 * (network, quota, malformed output), the pipeline keeps the original
 * findings rather than failing the whole run.
 */
import { callJson } from "../integrations/openai.js";
import {
  ok,
  fail,
  CONFIDENCE_THRESHOLD,
  type Appointment,
  type Medication,
  type OcrResult,
  type StageResult,
  type Warning,
} from "./types.js";

export type JudgeVerdictKind = "pass" | "review" | "fail";

export interface JudgeVerdict {
  id: string;
  verdict: JudgeVerdictKind;
  reason: string;
  correctedConfidence: number;
}

export interface JudgeReport {
  overall: "pass" | "review";
  summary: string;
  verdicts: JudgeVerdict[];
}

export interface FindingsInput {
  medications: Medication[];
  appointments: Appointment[];
  warnings: Warning[];
}

export interface JudgedFindings extends FindingsInput {
  /** Human-readable reasons for anything that wasn't a clean pass. */
  reviewReasons: string[];
}

const SYSTEM_PROMPT = `You are an independent medical-information verifier for a hospital discharge
app. You are given a numbered-line OCR transcript of a discharge document and
a set of structured findings that an extraction model produced from it. For
every finding, verify that it is actually supported by the source text.

Rules:
1. For each finding id, check that its key details (medication name and dose,
   appointment doctor/date/location, warning symptom/action) appear in the
   source text, ideally at or near the cited lines.
2. verdict "pass": the finding is fully supported by the document.
3. verdict "review": the finding is plausible but unclear, conflicting, or
   only partially supported by the source.
4. verdict "fail": the finding is NOT supported by the source text at all
   (a hallucination) — for example, a medication that never appears anywhere
   in the document.
5. Return a verdict for EVERY id you are given. Never invent new ids, and
   never add findings of your own.
6. correctedConfidence: your 0-100 confidence in the finding AFTER checking.
   "pass" findings should be 80-100; "review" findings below 80; "fail"
   findings 0-30.
7. summary: one sentence describing the overall quality of the extraction.
8. overall: "pass" only when every verdict is "pass"; otherwise "review".`;

const SCHEMA_HINT = `{
  "overall": "pass" | "review",
  "summary": string,
  "verdicts": [{
    "id": string,
    "verdict": "pass" | "review" | "fail",
    "reason": string,
    "correctedConfidence": number
  }]
}`;

const VALID_VERDICTS: JudgeVerdictKind[] = ["pass", "review", "fail"];

const UNVERIFIED_REASON = "No verdict returned for this finding.";

/** Optional dedicated judge model (OpenAI slot). Defaults to the main text model. */
function judgeModel(): string | undefined {
  const model = process.env.JUDGE_MODEL?.trim();
  return model || undefined;
}

function clampConfidence(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function judgeFindings(
  ocr: OcrResult,
  findings: FindingsInput,
): Promise<StageResult<JudgeReport>> {
  try {
    const total =
      findings.medications.length +
      findings.appointments.length +
      findings.warnings.length;
    if (total === 0) {
      return ok(
        { overall: "pass", summary: "No findings to verify.", verdicts: [] },
        100,
        [],
      );
    }

    const numberedText = ocr.lines
      .map((l) => `${l.line}: ${l.text}`)
      .join("\n");
    const raw = await callJson<Partial<JudgeReport>>({
      system: SYSTEM_PROMPT,
      user: `Source document:\n${numberedText}\n\nFindings to verify:\n${JSON.stringify(findings)}`,
      schemaHint: SCHEMA_HINT,
      model: judgeModel(),
    });

    // Model output is untrusted: drop verdicts for ids we never emitted,
    // normalize bad verdict kinds, and fill in missing verdicts as "review".
    const knownIds = new Set(
      [
        ...findings.medications,
        ...findings.appointments,
        ...findings.warnings,
      ].map((f) => f.id),
    );
    const normalized: JudgeVerdict[] = [];
    const rawVerdicts = Array.isArray(raw.verdicts) ? raw.verdicts : [];
    for (const entry of rawVerdicts) {
      if (!isRecord(entry)) continue;
      const id = typeof entry.id === "string" ? entry.id : "";
      if (!knownIds.has(id)) continue;
      normalized.push({
        id,
        verdict: VALID_VERDICTS.includes(entry.verdict as JudgeVerdictKind)
          ? (entry.verdict as JudgeVerdictKind)
          : "review",
        reason: typeof entry.reason === "string" ? entry.reason : "",
        correctedConfidence: clampConfidence(entry.correctedConfidence),
      });
    }
    const covered = new Set(normalized.map((v) => v.id));
    for (const id of knownIds) {
      if (!covered.has(id)) {
        normalized.push({
          id,
          verdict: "review",
          reason: UNVERIFIED_REASON,
          correctedConfidence: CONFIDENCE_THRESHOLD - 1,
        });
      }
    }

    const overall: JudgeReport["overall"] =
      normalized.length > 0 && normalized.every((v) => v.verdict === "pass")
        ? "pass"
        : "review";
    const report: JudgeReport = {
      overall,
      summary: typeof raw.summary === "string" ? raw.summary : "",
      verdicts: normalized,
    };
    return ok(report, judgeConfidence(report), []);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Judging failed");
  }
}

/**
 * Pipeline-facing confidence for the judge stage. Anything short of a clean
 * pass lands below the review threshold so the plan is flagged for review.
 */
export function judgeConfidence(report: JudgeReport): number {
  return report.overall === "pass" ? 100 : CONFIDENCE_THRESHOLD - 1;
}

/**
 * Applies judge verdicts deterministically:
 *   pass   -> keep as-is
 *   review -> keep, confidence capped below the review threshold
 *   fail   -> drop the finding
 */
export function applyJudgeVerdicts(
  findings: FindingsInput,
  report: JudgeReport,
): JudgedFindings {
  const verdictById = new Map(report.verdicts.map((v) => [v.id, v]));
  const reviewReasons: string[] = [];

  // Never mutate the caller's findings: review items are cloned with the
  // capped confidence instead of edited in place.
  const judgeList = <T extends { id: string; confidence: number }>(
    items: T[],
  ): T[] => {
    const kept: T[] = [];
    for (const item of items) {
      const verdict = verdictById.get(item.id);
      if (!verdict || verdict.verdict === "pass") {
        kept.push(item);
        continue;
      }
      if (verdict.verdict === "fail") {
        reviewReasons.push(verdict.reason || "Finding dropped by judge.");
        continue;
      }
      reviewReasons.push(verdict.reason || UNVERIFIED_REASON);
      kept.push({
        ...item,
        confidence: Math.min(item.confidence, CONFIDENCE_THRESHOLD - 1),
      });
    }
    return kept;
  };

  return {
    medications: judgeList(findings.medications),
    appointments: judgeList(findings.appointments),
    warnings: judgeList(findings.warnings),
    reviewReasons,
  };
}
