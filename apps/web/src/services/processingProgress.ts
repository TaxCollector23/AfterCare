/**
 * Live progress for the document-processing bar.
 *
 * A module-level store, so a page opened directly at /processing/:id sees the
 * same progress as the upload flow that started the stream — the same reason
 * useAuth keeps its session outside React.
 *
 * The percent shown is driven entirely by real pipeline stage events (see
 * pipelineProgress in shared-types). The easing in the Processing screen only
 * animates *toward* that number; it never invents progress of its own.
 */

import {
  pipelineProgress,
  type PipelineProgress,
  type PipelineStage,
} from "@discharge-guide/shared-types";

interface StreamState {
  completed: PipelineStage[];
  current: PipelineStage | null;
  finished: boolean;
}

const state = new Map<string, StreamState>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

function stateFor(documentId: string): StreamState {
  let existing = state.get(documentId);
  if (!existing) {
    existing = { completed: [], current: null, finished: false };
    state.set(documentId, existing);
  }
  return existing;
}

export function subscribeProgress(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Current progress for a document. Zeroed when nothing has been observed. */
export function progressFor(documentId: string): PipelineProgress {
  const current = state.get(documentId);
  return pipelineProgress({
    completed: current?.completed ?? [],
    current: current?.current ?? null,
    finished: current?.finished ?? false,
  });
}

/**
 * Records one pipeline stage event.
 *
 * A stage that failed still counts as finished work: the pipeline degrades and
 * carries on, so the bar must not stall on a stage that will never complete.
 */
export function recordStageEvent(
  documentId: string,
  stage: string,
  status: string | undefined,
): void {
  const entry = stateFor(documentId);
  const known = stage as PipelineStage;

  if (status === "started") {
    entry.current = known;
  } else if (status === "completed" || status === "failed") {
    if (!entry.completed.includes(known)) entry.completed.push(known);
    if (entry.current === known) entry.current = null;
  }
  notify();
}

export function markFinished(documentId: string): void {
  const entry = stateFor(documentId);
  entry.finished = true;
  entry.current = null;
  notify();
}

/** Drops a document's progress once the screen is done with it. */
export function clearProgress(documentId: string): void {
  state.delete(documentId);
  notify();
}
