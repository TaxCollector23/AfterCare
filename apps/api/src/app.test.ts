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

async function register() {
  const response = await request(app)
    .post("/auth/register")
    .send({ email: "patient@example.com", password: "a-safe-password-123" })
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
    expect(response.body.storage.mode).toBe("memory");
    expect(response.body.integrations[0].scope).toBe(
      "https://www.googleapis.com/auth/drive.file",
    );
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
});
