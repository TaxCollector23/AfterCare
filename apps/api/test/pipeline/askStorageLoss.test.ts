import { beforeEach, describe, it, expect, vi } from "vitest";
import request from "supertest";

const { callJsonMock, runOcrMock, loadDocumentMock } = vi.hoisted(() => ({
  callJsonMock: vi.fn(),
  runOcrMock: vi.fn(),
  loadDocumentMock: vi.fn(),
}));
vi.mock("../../src/integrations/openai.js", () => ({ callJson: callJsonMock }));
vi.mock("../../src/pipeline/ocr.js", () => ({ runOcr: runOcrMock }));
vi.mock("../../src/integrations/storage.js", () => ({
  loadDocument: loadDocumentMock,
  storageStatus: () => ({ configured: false, mode: "memory" }),
}));

import { askGrounded } from "../../src/pipeline/ask.js";
import { createApp } from "../../src/app.js";
import { repository } from "../../src/db/repository.js";
import { AppError } from "../../src/errors.js";
import { resetOcrCache } from "../../src/cache/index.js";
import { createTokens } from "../../src/middleware/auth.js";

const randomId = () => globalThis.crypto.randomUUID();

function seedDocument() {
  const user = repository.createUser("patient@example.com", "hash");
  const doc = {
    id: randomId(),
    userId: user.id,
    filename: "discharge.pdf",
    mimeType: "application/pdf",
    fileHash: `hash-${randomId()}`,
    storageKey: `users/${user.id}/documents/gone.enc`,
    uploadedAt: new Date().toISOString(),
    status: "ready" as const,
  };
  repository.createDocument(doc);
  return { user, doc };
}

beforeEach(() => {
  vi.resetAllMocks();
  repository.reset();
  resetOcrCache();
});

describe("asking about a document whose stored copy is gone", () => {
  it("reports it as its own condition, not as an AI outage", async () => {
    // The exact production shape: Postgres still has the row, but the bytes
    // lived in memory and the instance restarted.
    const { doc } = seedDocument();
    loadDocumentMock.mockRejectedValue(
      new AppError(404, "Stored document not found", "NOT_FOUND"),
    );

    await expect(
      askGrounded({ documentId: doc.id, question: "Can I shower?" }),
    ).rejects.toMatchObject({ code: "DOCUMENT_UNAVAILABLE", statusCode: 410 });
  });

  it("tells the patient to upload it again", async () => {
    const { doc } = seedDocument();
    loadDocumentMock.mockRejectedValue(
      new AppError(404, "Stored document not found", "NOT_FOUND"),
    );

    await expect(
      askGrounded({ documentId: doc.id, question: "Can I shower?" }),
    ).rejects.toThrow(/upload it again/i);
  });

  it("does not label the failure retryable over HTTP", async () => {
    const { user, doc } = seedDocument();
    loadDocumentMock.mockRejectedValue(
      new AppError(404, "Stored document not found", "NOT_FOUND"),
    );
    const { accessToken } = createTokens(user.id);

    const res = await request(createApp())
      .post("/ask")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ documentId: doc.id, question: "Can I shower?" });

    // Previously: 503 AI_PROVIDER_UNAVAILABLE with retryable:true, which drove
    // the endless "Try again" loop on the Ask screen.
    expect(res.status).toBe(410);
    expect(res.body.code).toBe("DOCUMENT_UNAVAILABLE");
    expect(res.body.retryable).not.toBe(true);
  });

  it("still reports a genuine AI outage as retryable", async () => {
    const { user, doc } = seedDocument();
    loadDocumentMock.mockResolvedValue(Buffer.from("pdf"));
    runOcrMock.mockResolvedValue({
      success: false,
      data: null,
      confidence: 0,
      sourceLines: [],
    });
    const { accessToken } = createTokens(user.id);

    const res = await request(createApp())
      .post("/ask")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ documentId: doc.id, question: "Can I shower?" });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("AI_PROVIDER_UNAVAILABLE");
    expect(res.body.retryable).toBe(true);
  });
});
