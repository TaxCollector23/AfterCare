/**
 * Stage 3a: Medication detection.
 *
 * SAFETY: dose/frequency/timing are extracted VERBATIM from the document.
 * Never normalize, round, unit-convert, or "correct" a dose here ? if it's
 * ambiguous, that's what the confidence score and the review banner are for.
 */
import { callJson } from "../integrations/openai.js";
import {
  ok,
  fail,
  type Medication,
  type OcrResult,
  type StageResult,
} from "./types.js";
import { randomUUID } from "node:crypto";

const SYSTEM_PROMPT = `You extract medication information from a numbered-line hospital discharge
document. For each medication, copy dose, frequency, and timing EXACTLY as
written ? never normalize units, round numbers, or infer a schedule that
isn't stated. If any field is unclear or missing, leave it as an empty
string rather than guessing. Cite the exact source line numbers you used.`;

const SCHEMA_HINT = `{
  "medications": [{
    "name": string,
    "dose": string,
    "frequency": string,
    "timing": string,
    "instructions": string,
    "sourceLines": number[],
    "confidence": number // 0-100, your confidence this is accurate and complete
  }]
}`;

interface RawMedication {
  name: string;
  dose: string;
  frequency: string;
  timing: string;
  instructions: string;
  sourceLines: number[];
  confidence: number;
}

export async function detectMedications(
  medicationsText: string,
  fullOcr: OcrResult,
): Promise<StageResult<Medication[]>> {
  try {
    if (!medicationsText.trim()) {
      return ok([], 100, []);
    }
    const validLines = new Set(fullOcr.lines.map((l) => l.line));
    const raw = await callJson<Partial<{ medications: RawMedication[] }>>({
      system: SYSTEM_PROMPT,
      user: medicationsText,
      schemaHint: SCHEMA_HINT,
    });
    const medications = Array.isArray(raw.medications) ? raw.medications : [];

    const result: Medication[] = medications.map((m) => {
      const sourceLines = Array.isArray(m.sourceLines)
        ? m.sourceLines.filter((n) => validLines.has(n))
        : [];
      return {
        id: randomUUID(),
        name: m.name ?? "",
        dose: m.dose ?? "",
        frequency: m.frequency ?? "",
        timing: m.timing ?? "",
        instructions: m.instructions ?? "",
        sourceLines,
        // An ungrounded citation (hallucinated line numbers) can't be trusted
        // at face value ? cap confidence rather than dropping the finding.
        confidence:
          sourceLines.length > 0
            ? (m.confidence ?? 0)
            : Math.min(m.confidence ?? 0, 50),
      };
    });

    const overall =
      result.length === 0
        ? 100
        : Math.round(
            result.reduce((sum, m) => sum + m.confidence, 0) / result.length,
          );

    return ok(
      result,
      overall,
      result.flatMap((m) => m.sourceLines),
    );
  } catch (err) {
    return fail(
      err instanceof Error ? err.message : "Medication detection failed",
    );
  }
}
