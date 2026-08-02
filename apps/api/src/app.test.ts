import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const aiMocks = vi.hoisted(() => ({
  runPipeline: vi.fn(),
  askGrounded: vi.fn(),
}));

vi.mock("./pipeline/orchestrator.js", () => ({
  runPipeline: aiMocks.runPipeline,
}));
vi.mock("./pipeline/ask.js", () => ({ askGrounded: aiMocks.askGrounded }));

import { createApp } from "./app.js";
import { closeCache } from "./cache/index.js";
import { repository } from "./db/repository.js";
import { resetDriveTokens } from "./integrations/googleDrive.js";
import { resetStorage } from "./integrations/storage.js";
import { createPipelineQueue, pipelineQueue } from "./queue/pipelineQueue.js";

const app = createApp();

beforeEach(() => {
  aiMocks.runPipeline
    .mockReset()
    .mockImplementation(async (documentId, emit) => {
      emit({ stage: "ocr", status: "started", data: null });
      emit({
        stage: "ocr",
        status: "completed",
        data: { isPlaceholder: true },
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
        isPlaceholder: true,
      };
    });
  aiMocks.askGrounded
    .mockReset()
    .mockImplementation(async ({ documentId }) => ({
      answer:
        "The document Q&A pipeline is not available yet. Please check the original document or contact your healthcare provider.",
      confidence: 0,
      source: { documentId, sourceLines: [] },
    }));
});

afterEach(() => {
  repository.reset();
  resetStorage();
  resetDriveTokens();
  pipelineQueue.reset();
});

async function register(email = "patient@example.com") {
  const response = await request(app)
    .post("/auth/register")
    .send({ email, password: "a-safe-password-123" })
    .expect(201);
  return response.body.accessToken as string;
}

async function createOwnedDocument() {
  const token = await register();
  const user = repository.findUserByEmail("patient@example.com")!;
  const documentId = "00000000-0000-4000-8000-000000000010";
  repository.createDocument({
    id: documentId,
    userId: user.id,
    filename: "instructions.pdf",
    mimeType: "application/pdf",
    fileHash: "ai-error-test-hash",
    storageKey: "ai-error-test-key",
    uploadedAt: new Date().toISOString(),
    status: "ready",
  });
  return { token, documentId };
}

const aiFailureCases = [
  {
    name: "missing provider configuration",
    error: {
      code: "AI_PROVIDER_CONFIG_MISSING",
      message: "OPENAI_API_KEY and Gemini keys missing",
      retryable: false,
      stack: "secret stack",
    },
    expected: {
      code: "AI_PROVIDER_CONFIG_MISSING",
      message: "AI processing is not configured.",
      retryable: false,
    },
    status: 503,
  },
  {
    name: "retryable provider outage",
    error: {
      code: "AI_PROVIDER_OUTAGE",
      message: "OpenAI 429 quota exhausted",
      retryable: true,
      provider: "openai",
    },
    expected: {
      code: "AI_PROVIDER_OUTAGE",
      message: "AI processing is temporarily unavailable.",
      retryable: true,
    },
    status: 503,
  },
  {
    name: "all providers unavailable",
    error: {
      code: "AI_PROVIDER_UNAVAILABLE",
      message: "OpenAI failed; Gemini key secret-key failed",
      retryable: true,
      quota: "0",
    },
    expected: {
      code: "AI_PROVIDER_UNAVAILABLE",
      message: "AI processing is temporarily unavailable.",
      retryable: true,
    },
    status: 503,
  },
  {
    name: "non-retryable validation failure",
    error: {
      code: "AI_VALIDATION_FAILED",
      message: "Gemini response included invalid medical dosage",
      retryable: false,
      raw: "provider payload",
    },
    expected: {
      code: "AI_VALIDATION_FAILED",
      message: "The request could not be processed safely.",
      retryable: false,
    },
    status: 422,
  },
] as const;

function expectNoProviderLeak(payload: string) {
  expect(payload).not.toMatch(
    /OpenAI|Gemini|quota|secret-key|provider payload|stack/i,
  );
}

describe("DischargeGuide API", () => {
  it("reports infrastructure status and the limited Drive scope", async () => {
    const response = await request(app).get("/health").expect(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.database.mode).toBe("memory");
    expect(response.body.database.ok).toBe(true);
    expect(response.body.storage.mode).toBe("memory");
    // In the test environment Redis is unconfigured, so the cache reports
    // healthy-by-default and the queue starts empty.
    expect(response.body.cache).toEqual({
      configured: false,
      connected: false,
      mode: "none",
    });
    expect(response.body.queue).toEqual({
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      deadLetter: 0,
      inFlight: 0,
    });
    expect(response.body.integrations[0].scope).toBe(
      "https://www.googleapis.com/auth/drive.file",
    );
  });

  it("reports degraded health when a configured dependency is down", async () => {
    const original = process.env.REDIS_URL;
    process.env.REDIS_URL = "redis://127.0.0.1:1"; // nothing listening
    try {
      const response = await request(app).get("/health").expect(503);
      expect(response.body.status).toBe("degraded");
      expect(response.body.cache.configured).toBe(true);
      expect(response.body.cache.connected).toBe(false);
      // A degraded health check must still expose all the usual fields.
      expect(response.body.database.mode).toBe("memory");
      expect(response.body.ai.timeoutMs).toBe(45_000);
    } finally {
      // Deleting (not assigning undefined, which becomes the string "undefined")
      // restores the unconfigured state that the rest of the suite expects.
      if (original === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = original;
      await closeCache(); // drop the failed connect attempt between tests
    }
  });

  it("reports which AI providers are configured without leaking keys", async () => {
    const response = await request(app).get("/health").expect(200);
    // In the test environment no AI credentials are set, so every provider
    // must report as unconfigured and no key material may appear.
    expect(response.body.ai.timeoutMs).toBe(45_000);
    expect(response.body.ai.waterfall).toEqual({
      openai: false,
      openrouter: false,
      geminiPrimary: false,
      geminiFallback: false,
    });
    expect(JSON.stringify(response.body.ai)).not.toMatch(/key|secret|sk-/i);
  });

  it("registers and logs in with JWT access and refresh tokens", async () => {
    const token = await register();
    expect(token).toBeTypeOf("string");
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "patient@example.com", password: "a-safe-password-123" })
      .expect(200);
    expect(login.body.accessExpiresInSeconds).toBe(900);
    expect(login.body.refreshExpiresInSeconds).toBe(604800);
    expect(login.body).not.toHaveProperty("passwordHash");
  });

  it("protects user-data routes", async () => {
    await request(app).get("/accessibility/prefs").expect(401);
  });

  it("uploads, deduplicates, decrypts, and processes a supported document", async () => {
    const token = await register();
    const bytes = Buffer.from("placeholder pdf");
    const upload = await request(app)
      .post("/upload")
      .set("authorization", `Bearer ${token}`)
      .attach("document", bytes, {
        filename: "instructions.pdf",
        contentType: "application/pdf",
      })
      .expect(202);

    expect(upload.body.documentId).toBeTypeOf("string");
    await new Promise((resolve) => setTimeout(resolve, 30));

    const stream = await request(app)
      .get(`/process/${upload.body.documentId}`)
      .set("authorization", `Bearer ${token}`)
      .expect(200);
    expect(stream.text).toContain("event: ocr");
    expect(stream.text).toContain("event: complete");

    const duplicate = await request(app)
      .post("/upload")
      .set("authorization", `Bearer ${token}`)
      .attach("document", bytes, {
        filename: "copy.pdf",
        contentType: "application/pdf",
      })
      .expect(200);
    expect(duplicate.body.documentId).toBe(upload.body.documentId);
    expect(duplicate.body.deduplicated).toBe(true);

    const original = await request(app)
      .get(`/documents/${upload.body.documentId}/original`)
      .set("authorization", `Bearer ${token}`)
      .buffer(true)
      .expect(200);
    expect(original.body).toEqual(bytes);

    const medications = await request(app)
      .get("/medications")
      .set("authorization", `Bearer ${token}`)
      .query({ documentId: upload.body.documentId })
      .expect(200);
    expect(medications.body).toEqual({ data: [] });

    const answer = await request(app)
      .post("/ask")
      .set("authorization", `Bearer ${token}`)
      .send({
        documentId: upload.body.documentId,
        question: "When do I take my medicine?",
      })
      .expect(200);
    expect(answer.body.confidence).toBe(0);
    expect(answer.body.source.sourceLines).toEqual([]);
  });

  it("lists plan data, logs adherence, and generates an ICS file", async () => {
    const token = await register();
    const user = repository.findUserByEmail("patient@example.com")!;
    const documentId = "00000000-0000-4000-8000-000000000002";
    const medicationId = "00000000-0000-4000-8000-000000000003";
    const appointmentId = "00000000-0000-4000-8000-000000000004";
    repository.createDocument({
      id: documentId,
      userId: user.id,
      filename: "instructions.pdf",
      mimeType: "application/pdf",
      fileHash: "plan-hash",
      storageKey: "plan-key",
      uploadedAt: new Date().toISOString(),
      status: "processing",
    });
    repository.savePlan(documentId, {
      documentId,
      status: "ready",
      disclaimer:
        "This app explains instructions; it never replaces medical advice.",
      explanations: [],
      isPlaceholder: false,
      warnings: [],
      timeline: [],
      medications: [
        {
          id: medicationId,
          name: "Source medication",
          dose: "source dose",
          frequency: "source frequency",
          timing: "source timing",
          instructions: "source instructions",
          takenAt: [],
          confidence: 90,
          sourceLines: [2],
        },
      ],
      appointments: [
        {
          id: appointmentId,
          date: "2026-08-14T10:30:00.000Z",
          doctor: "Dr. Source",
          specialty: "Cardiology",
          location: "Clinic",
          notes: "",
          confidence: 90,
          sourceLines: [8],
        },
      ],
    });

    const medications = await request(app)
      .get("/medications")
      .set("authorization", `Bearer ${token}`)
      .query({ documentId })
      .expect(200);
    expect(medications.body.data[0].id).toBe(medicationId);

    const taken = await request(app)
      .post(`/medications/${medicationId}/taken`)
      .set("authorization", `Bearer ${token}`)
      .expect(201);
    expect(taken.body.medicationId).toBe(medicationId);

    const calendar = await request(app)
      .post(`/appointments/${appointmentId}/calendar`)
      .set("authorization", `Bearer ${token}`)
      .expect(200);
    expect(calendar.text).toContain("BEGIN:VCALENDAR");
    expect(calendar.text).toContain("SUMMARY:Cardiology appointment");
  });

  it("rejects calendar export for an appointment without a concrete date", async () => {
    const token = await register();
    const user = repository.findUserByEmail("patient@example.com")!;
    const documentId = "00000000-0000-4000-8000-000000000005";
    const appointmentId = "00000000-0000-4000-8000-000000000006";
    repository.createDocument({
      id: documentId,
      userId: user.id,
      filename: "instructions.pdf",
      mimeType: "application/pdf",
      fileHash: "plan-hash-2",
      storageKey: "plan-key-2",
      uploadedAt: new Date().toISOString(),
      status: "processing",
    });
    repository.savePlan(documentId, {
      documentId,
      status: "ready",
      disclaimer:
        "This app explains instructions; it never replaces medical advice.",
      explanations: [],
      isPlaceholder: false,
      warnings: [],
      timeline: [],
      medications: [],
      appointments: [
        {
          id: appointmentId,
          // Free text ? the AI couldn't resolve a concrete calendar date.
          date: "in 2 weeks",
          doctor: "Dr. Source",
          specialty: "Cardiology",
          location: "Clinic",
          notes: "",
          confidence: 60,
          sourceLines: [8],
        },
      ],
    });

    const calendar = await request(app)
      .post(`/appointments/${appointmentId}/calendar`)
      .set("authorization", `Bearer ${token}`)
      .expect(422);
    expect(calendar.body.error).toMatch(/concrete date/);
  });

  it("rejects unsupported uploads", async () => {
    const token = await register();
    await request(app)
      .post("/upload")
      .set("authorization", `Bearer ${token}`)
      .attach("document", Buffer.from("text"), {
        filename: "notes.txt",
        contentType: "text/plain",
      })
      .expect(415);
  });

  it("stores accessibility preferences", async () => {
    const token = await register();
    const preferences = {
      textSize: "very_large",
      darkMode: true,
      highContrast: true,
      reduceMotion: true,
      voiceReading: true,
    };
    await request(app)
      .post("/accessibility/prefs")
      .set("authorization", `Bearer ${token}`)
      .send(preferences)
      .expect(200);
    const response = await request(app)
      .get("/accessibility/prefs")
      .set("authorization", `Bearer ${token}`)
      .expect(200);
    expect(response.body).toEqual(preferences);
  });

  it("audit logs user data access without recording request bodies", async () => {
    const token = await register();
    await request(app)
      .get("/accessibility/prefs")
      .set("authorization", `Bearer ${token}`)
      .expect(200);
    const logs = repository.inspect().auditLogs;
    expect(logs.some((log) => log.action.includes("/prefs"))).toBe(true);
    expect(JSON.stringify(logs)).not.toContain("a-safe-password-123");
  });

  it("keeps Google Drive unavailable until limited-scope OAuth is configured", async () => {
    const token = await register();
    const auth = await request(app)
      .post("/drive/auth")
      .set("authorization", `Bearer ${token}`)
      .expect(503);
    expect(auth.body.code).toBe("DRIVE_NOT_CONFIGURED");

    const imported = await request(app)
      .post("/drive/import")
      .set("authorization", `Bearer ${token}`)
      .send({ fileId: "local-test-file" })
      .expect(503);
    expect(imported.body.code).toBe("DRIVE_NOT_CONFIGURED");

    const upload = await request(app)
      .post("/upload")
      .set("authorization", `Bearer ${token}`)
      .attach("document", Buffer.from("drive-backup-test"), {
        filename: "instructions.pdf",
        contentType: "application/pdf",
      })
      .expect(202);
    await new Promise((resolve) => setTimeout(resolve, 30));
    const backup = await request(app)
      .post("/drive/backup")
      .set("authorization", `Bearer ${token}`)
      .send({ documentId: upload.body.documentId })
      .expect(503);
    expect(backup.body.code).toBe("DRIVE_NOT_CONFIGURED");
  });

  it("moves repeatedly failed pipeline jobs to the dead-letter queue", async () => {
    const documentId = "00000000-0000-4000-8000-000000000001";
    repository.createDocument({
      id: documentId,
      userId: "test-user",
      filename: "instructions.pdf",
      mimeType: "application/pdf",
      fileHash: "hash",
      storageKey: "key",
      uploadedAt: new Date().toISOString(),
      status: "uploaded",
    });
    const queue = createPipelineQueue(async () => {
      throw new Error("provider unavailable");
    });
    queue.enqueue(documentId);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(queue.getDeadLetter(documentId)?.attempts).toBe(3);
    expect(queue.getStats()).toEqual({
      queued: 0,
      running: 0,
      completed: 0,
      failed: 1,
      deadLetter: 1,
      inFlight: 0,
    });
    const document = repository.findDocument(documentId, "test-user");
    expect(document?.status).toBe("failed");
    expect(document?.failure?.code).toBe("AI_PROVIDER_UNAVAILABLE");
    expect(document?.failureOriginalDocumentUrl).toBe(
      `/documents/${documentId}/original`,
    );
    queue.reset();
  });

  it.each(aiFailureCases)(
    "sanitizes askGrounded: $name",
    async ({ error, expected, status }) => {
      const { token, documentId } = await createOwnedDocument();
      if (error.code === "AI_PROVIDER_CONFIG_MISSING") {
        aiMocks.askGrounded.mockResolvedValueOnce(error);
      } else {
        aiMocks.askGrounded.mockRejectedValueOnce(error);
      }

      const response = await request(app)
        .post("/ask")
        .set("authorization", `Bearer ${token}`)
        .send({ documentId, question: "What should I do?" })
        .expect(status);

      expect(response.body).toEqual(expected);
      expectNoProviderLeak(JSON.stringify(response.body));
    },
  );

  it.each(aiFailureCases)(
    "sanitizes runPipeline SSE failures: $name",
    async ({ error, expected }) => {
      const token = await register();
      if (error.code === "AI_PROVIDER_CONFIG_MISSING") {
        aiMocks.runPipeline.mockResolvedValue(error);
      } else {
        aiMocks.runPipeline.mockRejectedValue(error);
      }
      const upload = await request(app)
        .post("/upload")
        .set("authorization", `Bearer ${token}`)
        .attach("document", Buffer.from(`pipeline-${error.code}`), {
          filename: "instructions.pdf",
          contentType: "application/pdf",
        })
        .expect(202);

      await new Promise((resolve) =>
        setTimeout(resolve, error.retryable ? 150 : 30),
      );
      const stream = await request(app)
        .get(`/process/${upload.body.documentId}`)
        .set("authorization", `Bearer ${token}`)
        .expect(200);

      expect(stream.text).toContain("event: failed");
      expect(stream.text).toContain(`"code":"${expected.code}"`);
      expect(stream.text).toContain(`"retryable":${expected.retryable}`);
      expect(stream.text).toContain(expected.message);
      expectNoProviderLeak(stream.text);
      expect(
        pipelineQueue.getDeadLetter(upload.body.documentId)?.attempts,
      ).toBe(error.retryable ? 3 : 1);
    },
  );

  it("keeps unaffected routes working while AI providers are unavailable", async () => {
    aiMocks.runPipeline.mockRejectedValue({
      code: "AI_PROVIDER_UNAVAILABLE",
      message: "provider diagnostics",
      retryable: true,
    });
    aiMocks.askGrounded.mockRejectedValue({
      code: "AI_PROVIDER_UNAVAILABLE",
      message: "provider diagnostics",
      retryable: true,
    });
    const token = await register();
    await request(app).get("/health").expect(200);
    const preferences = await request(app)
      .get("/accessibility/prefs")
      .set("authorization", `Bearer ${token}`)
      .expect(200);
    expect(preferences.body.textSize).toBe("large");
  });

  it("rotates refresh tokens on /auth/refresh and revokes the family on reuse", async () => {
    const created = await request(app)
      .post("/auth/register")
      .send({ email: "rotate@example.com", password: "a-safe-password-123" })
      .expect(201);
    const firstRefresh = created.body.refreshToken as string;

    const rotated = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: firstRefresh })
      .expect(200);
    expect(rotated.body.accessToken).toBeTypeOf("string");
    expect(rotated.body.refreshToken).not.toBe(firstRefresh);

    // Reusing the old token is treated as theft: the whole family is revoked.
    await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: firstRefresh })
      .expect(401);
    await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);
  });

  it("rejects malformed or expired refresh tokens", async () => {
    await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: "not-a-real-token" })
      .expect(401);
    await request(app).post("/auth/refresh").send({}).expect(400);
  });

  it("logs out idempotently and revokes the refresh token", async () => {
    const created = await request(app)
      .post("/auth/register")
      .send({ email: "logout@example.com", password: "a-safe-password-123" })
      .expect(201);
    const refreshToken = created.body.refreshToken as string;

    await request(app).post("/auth/logout").send({ refreshToken }).expect(204);
    await request(app).post("/auth/refresh").send({ refreshToken }).expect(401);
    await request(app).post("/auth/logout").send({ refreshToken }).expect(204);
  });

  it("deletes a document, its stored file, plan, medications, and adherence", async () => {
    const token = await register();
    const bytes = Buffer.from("retention-test-document");
    const upload = await request(app)
      .post("/upload")
      .set("authorization", `Bearer ${token}`)
      .attach("document", bytes, {
        filename: "instructions.pdf",
        contentType: "application/pdf",
      })
      .expect(202);
    await new Promise((resolve) => setTimeout(resolve, 30));
    const { documentId } = upload.body;

    await request(app)
      .get(`/documents/${documentId}/original`)
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    await request(app)
      .delete(`/documents/${documentId}`)
      .set("authorization", `Bearer ${token}`)
      .expect(204);

    await request(app)
      .get(`/documents/${documentId}/original`)
      .set("authorization", `Bearer ${token}`)
      .expect(404);
    await request(app)
      .delete(`/documents/${documentId}`)
      .set("authorization", `Bearer ${token}`)
      .expect(404);
  });

  it("removes plan data and adherence records when a document is deleted", async () => {
    const token = await register();
    const user = repository.findUserByEmail("patient@example.com")!;
    const documentId = "00000000-0000-4000-8000-000000000005";
    const medicationId = "00000000-0000-4000-8000-000000000006";
    repository.createDocument({
      id: documentId,
      userId: user.id,
      filename: "instructions.pdf",
      mimeType: "application/pdf",
      fileHash: "delete-plan-hash",
      storageKey: "delete-plan-key",
      uploadedAt: new Date().toISOString(),
      status: "ready",
    });
    repository.savePlan(documentId, {
      documentId,
      status: "ready",
      disclaimer:
        "This app explains instructions; it never replaces medical advice.",
      explanations: [],
      isPlaceholder: false,
      warnings: [],
      timeline: [],
      medications: [
        {
          id: medicationId,
          name: "Source medication",
          dose: "source dose",
          frequency: "source frequency",
          timing: "source timing",
          instructions: "source instructions",
          takenAt: [],
          confidence: 90,
          sourceLines: [2],
        },
      ],
      appointments: [],
    });
    await request(app)
      .post(`/medications/${medicationId}/taken`)
      .set("authorization", `Bearer ${token}`)
      .expect(201);

    await request(app)
      .delete(`/documents/${documentId}`)
      .set("authorization", `Bearer ${token}`)
      .expect(204);

    const state = repository.inspect();
    expect(state.documents.has(documentId)).toBe(false);
    expect(state.medications.has(medicationId)).toBe(false);
    expect(state.adherence).toEqual([]);
  });

  it("does not let one user delete another user's document", async () => {
    const ownerToken = await register();
    const upload = await request(app)
      .post("/upload")
      .set("authorization", `Bearer ${ownerToken}`)
      .attach("document", Buffer.from("cross-user-delete"), {
        filename: "instructions.pdf",
        contentType: "application/pdf",
      })
      .expect(202);
    await new Promise((resolve) => setTimeout(resolve, 30));

    const otherToken = await register("other@example.com");
    await request(app)
      .delete(`/documents/${upload.body.documentId}`)
      .set("authorization", `Bearer ${otherToken}`)
      .expect(404);
  });

  it("rate limits /ask separately from the general API limit", async () => {
    const limitedApp = createApp({ askRateLimit: 2 });

    const created = await request(limitedApp)
      .post("/auth/register")
      .send({
        email: "asklimit@example.com",
        password: "a-safe-password-123",
      })
      .expect(201);
    const token = created.body.accessToken as string;
    const user = repository.findUserByEmail("asklimit@example.com")!;
    const documentId = "00000000-0000-4000-8000-000000000098";
    repository.createDocument({
      id: documentId,
      userId: user.id,
      filename: "instructions.pdf",
      mimeType: "application/pdf",
      fileHash: "ask-limit-hash",
      storageKey: "ask-limit-key",
      uploadedAt: new Date().toISOString(),
      status: "ready",
    });

    const body = { documentId, question: "How often?" };
    await request(limitedApp)
      .post("/ask")
      .set("authorization", `Bearer ${token}`)
      .send(body)
      .expect(200);
    await request(limitedApp)
      .post("/ask")
      .set("authorization", `Bearer ${token}`)
      .send(body)
      .expect(200);
    const limited = await request(limitedApp)
      .post("/ask")
      .set("authorization", `Bearer ${token}`)
      .send(body)
      .expect(429);
    expect(limited.body.code).toBe("ASK_RATE_LIMITED");
  });

  it("keys /ask rate limits per user, not per IP", async () => {
    // Both users share one IP (supertest); only user A exhausts the budget.
    const limitedApp = createApp({ askRateLimit: 2 });
    const tokenA = await register("ask-user-a@example.com");
    const tokenB = await register("ask-user-b@example.com");
    const userA = repository.findUserByEmail("ask-user-a@example.com")!;
    const userB = repository.findUserByEmail("ask-user-b@example.com")!;
    const documentIdA = "00000000-0000-4000-8000-000000000098";
    const documentIdB = "00000000-0000-4000-8000-000000000099";
    repository.createDocument({
      id: documentIdA,
      userId: userA.id,
      filename: "instructions.pdf",
      mimeType: "application/pdf",
      fileHash: "ask-key-a-hash",
      storageKey: "ask-key-a",
      uploadedAt: new Date().toISOString(),
      status: "ready",
    });
    repository.createDocument({
      id: documentIdB,
      userId: userB.id,
      filename: "instructions.pdf",
      mimeType: "application/pdf",
      fileHash: "ask-key-b-hash",
      storageKey: "ask-key-b",
      uploadedAt: new Date().toISOString(),
      status: "ready",
    });

    const askA = () =>
      request(limitedApp)
        .post("/ask")
        .set("authorization", `Bearer ${tokenA}`)
        .send({ documentId: documentIdA, question: "How often?" });
    const askB = () =>
      request(limitedApp)
        .post("/ask")
        .set("authorization", `Bearer ${tokenB}`)
        .send({ documentId: documentIdB, question: "How often?" });

    await askA().expect(200);
    await askA().expect(200);
    await askA().expect(429); // user A exhausted its own budget
    await askB().expect(200); // user B is unaffected despite the shared IP
  });
});
