import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RecoveryPlan } from "@discharge-guide/shared-types";
import { createApp } from "../../src/app.js";
import { repository } from "../../src/db/repository.js";
import { loadDocument, resetStorage } from "../../src/integrations/storage.js";
import { runOcr } from "../../src/pipeline/ocr.js";
import { createPipelineQueue } from "../../src/queue/pipelineQueue.js";

const FIXTURE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/john-doe-report.pdf",
);

async function register(app: ReturnType<typeof createApp>) {
  const response = await request(app)
    .post("/auth/register")
    .send({ email: "john.doe@example.com", password: "a-safe-password-123" })
    .expect(201);
  return response.body.accessToken as string;
}

describe("POST /upload with the John Doe sample report", () => {
  afterEach(() => {
    repository.reset();
    resetStorage();
  });

  it("stores the PDF and completes processing after real OCR reads it", async () => {
    const queue = createPipelineQueue(async (documentId, emit) => {
      const document = repository.findDocumentById(documentId);
      if (!document) throw new Error("document missing");

      emit({ stage: "ocr", status: "started", data: null });
      const ocr = await runOcr({
        buffer: await loadDocument(document.storageKey),
        mimeType: document.mimeType,
      });
      if (!ocr.success || !ocr.data) {
        throw new Error(ocr.error ?? "OCR failed");
      }
      emit({
        stage: "ocr",
        status: "completed",
        data: {
          pageCount: ocr.data.pageCount,
          preview: ocr.data.text.slice(0, 160),
        },
      });

      return {
        documentId,
        status: "ready",
        disclaimer:
          "This app explains instructions; it never replaces medical advice.",
        medications: [],
        appointments: [],
        warnings: [],
        timeline: [],
        explanations: [],
        isPlaceholder: false,
      } satisfies RecoveryPlan;
    });
    const app = createApp({ queue, heartbeatMs: 1_000 });
    const token = await register(app);
    const pdf = readFileSync(FIXTURE_PATH);

    const upload = await request(app)
      .post("/upload")
      .set("authorization", `Bearer ${token}`)
      .attach("document", pdf, {
        filename: "Fake_Medical_Report_John_Doe.pdf",
        contentType: "application/pdf",
      })
      .expect(202);

    await new Promise((resolve) => setTimeout(resolve, 25));

    const stream = await request(app)
      .get(`/process/${upload.body.documentId}`)
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    expect(stream.text).toContain("event: ocr");
    expect(stream.text).toContain("Patient: John Doe");
    expect(stream.text).toContain("event: complete");

    const original = await request(app)
      .get(`/documents/${upload.body.documentId}/original`)
      .set("authorization", `Bearer ${token}`)
      .buffer(true)
      .expect(200);
    expect(original.body).toEqual(pdf);

    queue.reset();
  });
});
