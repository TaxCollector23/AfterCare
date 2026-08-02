/**
 * Stage 3b: Appointment detection — date, doctor, specialty, location.
 */
import { callJson } from '../integrations/openai.js';
import { ok, fail, type Appointment, type OcrResult, type StageResult } from '@discharge/shared-types';
import { randomUUID } from 'node:crypto';

const SYSTEM_PROMPT = `You extract follow-up appointment information from a numbered-line hospital
discharge document. If a date is a concrete calendar date, put it in "date"
as ISO 8601 (YYYY-MM-DD). If it's relative ("in 2 weeks", "follow up with
your PCP") and can't be resolved to a concrete date, leave "date" null and
put the original text in "dateText". Cite source line numbers.`;

const SCHEMA_HINT = `{
  "appointments": [{
    "date": string | null,
    "dateText": string,
    "doctor": string,
    "specialty": string,
    "location": string,
    "notes": string,
    "sourceLines": number[],
    "confidence": number
  }]
}`;

interface RawAppointment {
  date: string | null;
  dateText: string;
  doctor: string;
  specialty: string;
  location: string;
  notes: string;
  sourceLines: number[];
  confidence: number;
}

export async function detectAppointments(
  appointmentsText: string,
  fullOcr: OcrResult,
): Promise<StageResult<Appointment[]>> {
  try {
    if (!appointmentsText.trim()) {
      return ok([], 100, []);
    }
    const validLines = new Set(fullOcr.lines.map((l) => l.line));
    const raw = await callJson<Partial<{ appointments: RawAppointment[] }>>({
      system: SYSTEM_PROMPT,
      user: appointmentsText,
      schemaHint: SCHEMA_HINT,
    });
    const appointments = Array.isArray(raw.appointments) ? raw.appointments : [];

    const result: Appointment[] = appointments.map((a) => {
      const sourceLines = Array.isArray(a.sourceLines)
        ? a.sourceLines.filter((n) => validLines.has(n))
        : [];
      const rawConfidence = Math.max(0, Math.min(100, a.confidence ?? 0));
      return {
        id: randomUUID(),
        date: a.date ?? null,
        dateText: a.dateText ?? '',
        doctor: a.doctor ?? '',
        specialty: a.specialty ?? '',
        location: a.location ?? '',
        notes: a.notes ?? '',
        sourceLines,
        confidence: sourceLines.length > 0 ? rawConfidence : Math.min(rawConfidence, 50),
      };
    });

    const overall =
      result.length === 0
        ? 100
        : Math.round(Math.max(0, Math.min(100, result.reduce((sum, a) => sum + a.confidence, 0) / result.length)));

    return ok(result, overall, result.flatMap((a) => a.sourceLines));
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Appointment detection failed');
  }
}
