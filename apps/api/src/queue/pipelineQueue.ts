import type {
  PipelineEvent,
  RecoveryPlan,
  StructuredAiError,
} from "@discharge/shared-types";
import { EventEmitter } from "node:events";
import { repository } from "../db/repository.js";
import { isStructuredAiError, sanitizeAiError } from "../errors.js";
import { runPipeline } from "../pipeline/orchestrator.js";

export interface StreamEvent extends PipelineEvent {
  documentId: string;
  timestamp: string;
}

interface QueueJob {
  documentId: string;
  attempts: number;
  state: "queued" | "running" | "completed" | "failed";
  errorCode?: string;
}

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

type PipelineRunner = typeof runPipeline;

export function createPipelineQueue(runner: PipelineRunner = runPipeline) {
  const events = new EventEmitter();
  events.setMaxListeners(100);
  const history = new Map<string, StreamEvent[]>();
  const jobs = new Map<string, QueueJob>();
  const deadLetterQueue = new Map<string, QueueJob>();

  function publish(documentId: string, event: PipelineEvent) {
    const streamEvent = {
      ...event,
      ...(event.status === "failed" && event.error
        ? { error: sanitizeAiError(event.error), data: null }
        : {}),
      documentId,
      timestamp: new Date().toISOString(),
    };
    const documentHistory = history.get(documentId) ?? [];
    documentHistory.push(streamEvent);
    history.set(documentId, documentHistory);
    events.emit(documentId, streamEvent);
  }

  async function run(job: QueueJob) {
    job.state = "running";
    repository.updateDocument(job.documentId, { status: "processing" });
    try {
      const result = await runner(job.documentId, (event) =>
        publish(job.documentId, event),
      );
      if (isStructuredAiError(result)) throw result;
      const plan: RecoveryPlan = result;
      repository.savePlan(job.documentId, plan);
      job.state = "completed";
      events.emit(`${job.documentId}:complete`, plan);
    } catch (error) {
      const publicError = sanitizeAiError(error);
      job.attempts += 1;
      if (publicError.retryable && job.attempts < 3) {
        await delay(25 * 2 ** (job.attempts - 1));
        await run(job);
        return;
      }
      job.state = "failed";
      job.errorCode = publicError.code;
      deadLetterQueue.set(job.documentId, { ...job });
      repository.updateDocument(job.documentId, {
        status: "failed",
        failure: publicError,
        failureOriginalDocumentUrl: `/documents/${job.documentId}/original`,
      });
      events.emit(`${job.documentId}:failed`, publicError);
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
    onFailure(
      documentId: string,
      listener: (error: StructuredAiError) => void,
    ) {
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
    listenerCount(documentId: string) {
      return (
        events.listenerCount(documentId) +
        events.listenerCount(`${documentId}:complete`) +
        events.listenerCount(`${documentId}:failed`)
      );
    },
    reset() {
      events.removeAllListeners();
      history.clear();
      jobs.clear();
      deadLetterQueue.clear();
    },
  };
}

export type PipelineQueue = ReturnType<typeof createPipelineQueue>;
export const pipelineQueue = createPipelineQueue();
