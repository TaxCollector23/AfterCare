import { useEffect, useRef, useState } from "react";
import {
  progressFor,
  subscribeProgress,
} from "../services/processingProgress";

/**
 * Progress bar for document processing.
 *
 * Two things make it read as real rather than as a fake timer:
 *
 * 1. The target percent comes from actual pipeline stage events, weighted by
 *    how long each stage really takes (OCR is ~30% of the work).
 * 2. Between events the displayed value eases toward that target and then
 *    creeps very slowly, so a long stage looks busy instead of frozen. The
 *    creep is capped just short of the target, so it can never overtake real
 *    progress or reach 100% before the pipeline actually finishes.
 */

/** Fraction of the remaining gap closed per tick — fast at first, then slower. */
const EASE_FACTOR = 0.12;
/** How close the eased value may creep to the target while a stage is running. */
const CREEP_CEILING = 0.995;
/**
 * Floor on movement per tick. Pure proportional easing approaches its target
 * asymptotically, which left the finished bar sitting at 99% for seconds; this
 * guarantees it closes the last stretch in bounded time.
 */
const MIN_STEP = 0.4;
const TICK_MS = 80;

export function ProcessingProgress({ documentId }: { documentId: string }) {
  const [target, setTarget] = useState(() => progressFor(documentId));
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);

  useEffect(
    () => subscribeProgress(() => setTarget(progressFor(documentId))),
    [documentId],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const ceiling =
        target.percent >= 100 ? 100 : target.percent * CREEP_CEILING;
      const gap = ceiling - shownRef.current;
      if (Math.abs(gap) < 0.01) return;

      const eased = Math.abs(gap) * EASE_FACTOR;
      const step = Math.sign(gap) * Math.max(eased, Math.min(MIN_STEP, Math.abs(gap)));
      const next = shownRef.current + step;
      // Snap once the remaining gap is smaller than a step, so it settles cleanly.
      const settled = Math.abs(ceiling - next) < MIN_STEP ? ceiling : next;

      shownRef.current = settled;
      setShown(settled);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [target.percent]);

  const rounded = Math.round(shown);

  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div
        className="progress-bar"
        style={{ maxWidth: 320, margin: "0 auto" }}
        role="progressbar"
        aria-valuenow={rounded}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${rounded}% — ${target.label}`}
      >
        <span style={{ width: `${shown}%` }} />
      </div>

      <p style={{ marginTop: 16, marginBottom: 4 }}>{target.label}…</p>
      <p className="gloss" style={{ margin: 0, fontSize: 15 }}>
        {rounded}%
        {target.completedStages > 0 &&
          ` · step ${Math.min(
            target.completedStages + 1,
            target.totalStages,
          )} of ${target.totalStages}`}
      </p>
    </div>
  );
}
