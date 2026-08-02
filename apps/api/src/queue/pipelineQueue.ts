import type { PipelineEvent, RecoveryPlan } from "@discharge-guide/shared-types";
import { EventEmitter } from "node:events";
import { repository } from "../db/repository.js";
import { runPipeline } from "../pipeline/orchestrator.js";

export interface StreamEvent extends PipelineEvent {
  documentId: string;
  timestamp: string;
}

interface QueueJob {
  documentId: string;
  attempts: number;
  state: "queued" | "running" | "completed" | "failed";
  error?: string;
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

type PipelineRunner = typeof runPipeline;

export function createPipelineQueue(runner: PipelineRunner = runPipeline) {
  const events = new EventEmitter();
  events.setMaxListeners(100);
  const history = new Map<string, StreamEvent[]>();
  const jobs = new Map<string, QueueJob>();
  const deadLetterQueue = new Map<string, QueueJob>();

  function publish(documentId: string, event: PipelineEvent) {
    const streamEvent = { ...event, documentId, timestamp: new Date().toISOString() };
    const documentHistory = history.get(documentId) ?? [];
    documentHistory.push(streamEvent);
    history.set(documentId, documentHistory);
    events.emit(documentId, streamEvent);
  }

  async function run(job: QueueJob) {
    job.state = "running";
    repository.updateDocument(job.documentId, { status: "processing" });
    try {
      const plan: RecoveryPlan = await runner(job.documentId, (event) =>
        publish(job.documentId, event)
      );
      repository.savePlan(job.documentId, plan);
      job.state = "completed";
      events.emit(`${job.documentId}:complete`, plan);
    } catch (error) {
      job.attempts += 1;
      if (job.attempts < 3) {
        await delay(25 * 2 ** (job.attempts - 1));
        await run(job);
        return;
      }
      job.state = "failed";
      job.error = error instanceof Error ? error.message : "Pipeline failed";
      deadLetterQueue.set(job.documentId, { ...job });
      const failureMessage =
        `We couldn't confirm the discharge instructions. Please check the original document at ` +
        `/documents/${job.documentId}/original.`;
      repository.updateDocument(job.documentId, { status: "failed", failureMessage });
      events.emit(`${job.documentId}:failed`, failureMessage);
    }
  }

  return {
    enqueue(documentId: string) {
      if (jobs.has(documentId)) return jobs.get(documentId)!;
      const job: QueueJob = { documentId, attempts: 0, state: "queued" };
      jobs.set(documentId, job);
      queueMicrotask(() => void run(job));
      return job;
    },
    subscribe(documentId: string, listener: (event: StreamEvent) => void) {
      events.on(documentId, listener);
      return () => events.off(documentId, listener);
    },
    onComplete(documentId: string, listener: (plan: RecoveryPlan) => void) {
      events.on(`${documentId}:complete`, listener);
      return () => events.off(`${documentId}:complete`, listener);
    },
    onFailure(documentId: string, listener: (message: string) => void) {
      events.on(`${documentId}:failed`, listener);
      return () => events.off(`${documentId}:failed`, listener);
    },
    getHistory(documentId: string) {
      return history.get(documentId) ?? [];
    },
    getJob(documentId: string) {
      return jobs.get(documentId);
    },
    getDeadLetter(documentId: string) {
      return deadLetterQueue.get(documentId);
    },
    reset() {
      events.removeAllListeners();
      history.clear();
      jobs.clear();
      deadLetterQueue.clear();
    }
  };
}

export const pipelineQueue = createPipelineQueue();
