import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RecoveryPlan } from "@discharge-guide/shared-types";
import { repository } from "../db/repository.js";
import { createPipelineQueue } from "./pipelineQueue.js";

function createDocument(documentId: string) {
  repository.createDocument({
    id: documentId,
    userId: "test-user",
    filename: "instructions.pdf",
    mimeType: "application/pdf",
    fileHash: `hash-${documentId}`,
    storageKey: `key-${documentId}`,
    uploadedAt: new Date().toISOString(),
    status: "uploaded",
  });
}

function planFor(documentId: string): RecoveryPlan {
  // Cast via unknown so this fixture compiles against both the on-disk
  // shared-types (which requires `explanations`) and origin/main's (which
  // does not yet) — the queue only reads the plan fields it uses.
  return {
    documentId,
    status: "ready",
    disclaimer: "This app explains instructions; it never replaces medical advice.",
    medications: [],
    appointments: [],
    warnings: [],
    timeline: [],
    isPlaceholder: false,
  } as unknown as RecoveryPlan;
}

describe("pipeline queue memory bounds", () => {
  beforeEach(() => repository.reset());
  afterEach(() => repository.reset());

  it("caps the SSE history kept per document", async () => {
    createDocument("doc-cap");
    const queue = createPipelineQueue(
      async (documentId, emit) => {
        for (let i = 0; i < 1200; i += 1) {
          emit({ stage: "ocr", status: "started", data: null });
        }
        return planFor(documentId);
      },
      { maxHistoryPerDocument: 100 },
    );

    const done = new Promise<void>((resolve) => {
      queue.onComplete("doc-cap", () => resolve());
    });
    queue.enqueue("doc-cap");
    await done;

    expect(queue.getHistory("doc-cap").length).toBe(100);
    queue.reset();
  });

  it("prunes completed jobs, their history, and dead letters after retention", async () => {
    createDocument("doc-prune");
    const queue = createPipelineQueue(
      async (documentId, emit) => {
        emit({ stage: "ocr", status: "started", data: null });
        return planFor(documentId);
      },
      { retentionMs: 10 },
    );

    const done = new Promise<void>((resolve) => {
      queue.onComplete("doc-prune", () => resolve());
    });
    queue.enqueue("doc-prune");
    await done;

    expect(queue.getJob("doc-prune")?.state).toBe("completed");
    expect(queue.getHistory("doc-prune").length).toBe(1);

    // A future "now" makes the completed job older than the retention window.
    queue.prune(Date.now() + 5_000);

    expect(queue.getJob("doc-prune")).toBeUndefined();
    expect(queue.getHistory("doc-prune")).toEqual([]);
    expect(queue.getStats()).toMatchObject({
      completed: 0,
      failed: 0,
      deadLetter: 0,
    });
    queue.reset();
  });

  it("prunes dead-letter entries for failed jobs after retention", async () => {
    createDocument("doc-fail");
    const queue = createPipelineQueue(
      async () => {
        throw new Error("provider unavailable");
      },
      { retentionMs: 10 },
    );

    // Retryable errors are retried 3 times, so give the DLQ entry time to form.
    const done = new Promise<void>((resolve) => {
      queue.onFailure("doc-fail", () => resolve());
    });
    queue.enqueue("doc-fail");
    await done;

    expect(queue.getDeadLetter("doc-fail")?.attempts).toBe(3);
    queue.prune(Date.now() + 5_000);
    expect(queue.getDeadLetter("doc-fail")).toBeUndefined();
    expect(queue.getJob("doc-fail")).toBeUndefined();
    queue.reset();
  });

  it("keeps queued and running jobs across a prune", async () => {
    createDocument("doc-active");
    let release: (plan: RecoveryPlan) => void = () => undefined;
    const gate = new Promise<RecoveryPlan>((resolve) => {
      release = resolve;
    });
    const queue = createPipelineQueue(
      async (documentId) => gate.then(() => planFor(documentId)),
      { retentionMs: 10 },
    );

    queue.enqueue("doc-active");
    // The job is still queued/running; a prune must not touch it.
    queue.prune(Date.now() + 60_000);
    expect(queue.getJob("doc-active")).toBeDefined();

    release(planFor("doc-active"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(queue.getJob("doc-active")?.state).toBe("completed");
    queue.reset();
  });

  it("defaults to a generous retention window", async () => {
    createDocument("doc-default");
    const queue = createPipelineQueue(async (documentId, emit) => {
      emit({ stage: "ocr", status: "started", data: null });
      return planFor(documentId);
    });
    const done = new Promise<void>((resolve) => {
      queue.onComplete("doc-default", () => resolve());
    });
    queue.enqueue("doc-default");
    await done;

    // Default retention is 30 minutes: a just-completed job survives pruning.
    queue.prune();
    expect(queue.getJob("doc-default")?.state).toBe("completed");
    // The runner emitted exactly one event (the ocr "started").
    expect(queue.getHistory("doc-default").length).toBe(1);
    queue.reset();
  });
});
