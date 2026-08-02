/**
 * Stage 3c: Warning detection — ER red-flag symptoms for the always-pinned
 * Emergency screen. Errs toward over-including: a missed warning is a much
 * worse failure mode than a redundant one.
 */
import { callJson } from '../integrations/openai.js';
import { ok, fail, type OcrResult, type Warning, type StageResult } from '@discharge/shared-types';
import { randomUUID } from 'node:crypto';

const SYSTEM_PROMPT = `You extract emergency warning signs from a numbered-line hospital discharge
document — symptoms the patient is told to watch for that mean they should
call their doctor or go to the ER. Err on the side of including anything
that reads as a red flag, even if phrased casually. For each, state the
action ("call your doctor" vs "go to the ER / call 911") and classify
severity. Cite source line numbers.`;

const SCHEMA_HINT = `{
  "warnings": [{
    "symptom": string,
    "action": string,
    "severity": "call-doctor" | "emergency",
    "sourceLines": number[],
    "confidence": number
  }]
}`;

interface RawWarning {
  symptom: string;
  action: string;
  severity: 'call-doctor' | 'emergency';
  sourceLines: number[];
  confidence: number;
}

export async function detectWarnings(
  warningsText: string,
  fullOcr: OcrResult,
): Promise<StageResult<Warning[]>> {
  try {
    if (!warningsText.trim()) {
      return ok([], 100, []);
    }
    const validLines = new Set(fullOcr.lines.map((l) => l.line));
    const raw = await callJson<Partial<{ warnings: RawWarning[] }>>({
      system: SYSTEM_PROMPT,
      user: warningsText,
      schemaHint: SCHEMA_HINT,
    });
    const warnings = Array.isArray(raw.warnings) ? raw.warnings : [];

    const result: Warning[] = warnings.map((w) => {
      const sourceLines = Array.isArray(w.sourceLines)
        ? w.sourceLines.filter((n) => typeof n === 'number' && Number.isInteger(n) && validLines.has(n))
        : [];
      const rawConfidence = Math.max(0, Math.min(100, w.confidence ?? 0));
      return {
        id: randomUUID(),
        symptom: w.symptom ?? '',
        action: w.action ?? '',
        // Unknown/missing severity defaults to the more cautious option —
        // a false emergency is far cheaper than a missed one.
        severity: w.severity === 'call-doctor' ? 'call-doctor' : 'emergency',
        sourceLines,
        confidence: sourceLines.length > 0 ? rawConfidence : Math.min(rawConfidence, 50),
      };
    });

    const overall =
      result.length === 0
        ? 100
        : Math.round(Math.max(0, Math.min(100, result.reduce((sum, w) => sum + w.confidence, 0) / result.length)));

    return ok(result, overall, result.flatMap((w) => w.sourceLines));
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Warning detection failed');
  }
}
