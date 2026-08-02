/**
 * Stage 4: Timeline builder — buckets recovery milestones into
 * Today / Tomorrow / This week / Later, for the Timeline screen.
 *
 * Takes the raw "timeline" text bucket from extraction plus any medication/
 * appointment data already extracted, so it can place things like "first
 * dose of antibiotics" or "follow-up in 2 weeks" on the same timeline.
 */
import { callJson } from '../integrations/openai.js';
import {
  ok,
  fail,
  type Appointment,
  type Medication,
  type OcrResult,
  type TimelineEntry,
  type StageResult,
} from '@discharge/shared-types';
import { randomUUID } from 'node:crypto';

const VALID_BUCKETS: TimelineEntry['bucket'][] = ['today', 'tomorrow', 'this-week', 'later'];

const SYSTEM_PROMPT = `You build a recovery timeline for a patient from a numbered-line hospital
discharge document, plus already-extracted medications and appointments
given as JSON context. Bucket each milestone into one of: "today",
"tomorrow", "this-week", "later". Keep entries short and patient-facing
(plain language, not clinical jargon). Cite source line numbers where the
milestone came from the raw text; for milestones derived purely from the
provided medication/appointment JSON, sourceLines may be empty.`;

const SCHEMA_HINT = `{
  "timeline": [{
    "bucket": "today" | "tomorrow" | "this-week" | "later",
    "title": string,
    "detail": string,
    "sourceLines": number[],
    "confidence": number
  }]
}`;

interface RawTimelineEntry {
  bucket: TimelineEntry['bucket'];
  title: string;
  detail: string;
  sourceLines: number[];
  confidence: number;
}

export async function buildTimeline(
  timelineText: string,
  context: { medications: Medication[]; appointments: Appointment[] },
  fullOcr?: OcrResult,
): Promise<StageResult<TimelineEntry[]>> {
  try {
    if (!timelineText.trim() && context.medications.length === 0 && context.appointments.length === 0) {
      return ok([], 100, []);
    }
    const validLines = fullOcr ? new Set(fullOcr.lines.map((l) => l.line)) : null;
    const user = JSON.stringify({
      timelineText,
      medications: context.medications,
      appointments: context.appointments,
    });
    const raw = await callJson<Partial<{ timeline: RawTimelineEntry[] }>>({
      system: SYSTEM_PROMPT,
      user,
      schemaHint: SCHEMA_HINT,
    });
    const timeline = Array.isArray(raw.timeline) ? raw.timeline : [];

    const result: TimelineEntry[] = timeline.map((t) => {
      // Empty sourceLines is valid here (a milestone derived purely from
      // meds/appts JSON) — only filter out lines that don't exist at all.
      const sourceLines = Array.isArray(t.sourceLines)
        ? validLines
          ? t.sourceLines.filter((n) => validLines.has(n))
          : t.sourceLines
        : [];
      return {
        id: randomUUID(),
        bucket: VALID_BUCKETS.includes(t.bucket) ? t.bucket : 'later',
        title: t.title ?? '',
        detail: t.detail ?? '',
        sourceLines,
        confidence: t.confidence ?? 0,
      };
    });

    const overall =
      result.length === 0
        ? 100
        : Math.round(result.reduce((sum, t) => sum + t.confidence, 0) / result.length);

    return ok(result, overall, result.flatMap((t) => t.sourceLines));
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Timeline building failed');
  }
}
