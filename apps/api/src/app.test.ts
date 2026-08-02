import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { repository } from "./db/repository.js";
import { resetDriveTokens } from "./integrations/googleDrive.js";
import { resetStorage } from "./integrations/storage.js";
import { createPipelineQueue, pipelineQueue } from "./queue/pipelineQueue.js";

const app = createApp();

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

describe("DischargeGuide API", () => {
  it("reports infrastructure status and the limited Drive scope", async () => {
    const response = await request(app).get("/health").expect(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.database.mode).toBe("memory");
    expect(response.body.storage.mode).toBe("memory");
    expect(response.body.integrations[0].scope).toBe("https://www.googleapis.com/auth/drive.file");
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
        contentType: "application/pdf"
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
      .attach("document", bytes, { filename: "copy.pdf", contentType: "application/pdf" })
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
      .send({ documentId: upload.body.documentId, question: "When do I take my medicine?" })
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
      status: "processing"
    });
    repository.savePlan(documentId, {
      documentId,
      status: "ready",
      disclaimer: "This app explains instructions; it never replaces medical advice.",
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
          sourceLines: [2]
        }
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
          sourceLines: [8]
        }
      ]
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
        contentType: "text/plain"
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
      voiceReading: true
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
    const response = await request(app)
      .post("/drive/auth")
      .set("authorization", `Bearer ${token}`)
      .expect(503);
    expect(response.body.code).toBe("DRIVE_NOT_CONFIGURED");
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
      status: "uploaded"
    });
    const queue = createPipelineQueue(async () => {
      throw new Error("provider unavailable");
    });
    queue.enqueue(documentId);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(queue.getDeadLetter(documentId)?.attempts).toBe(3);
    const document = repository.findDocument(documentId, "test-user");
    expect(document?.status).toBe("failed");
    expect(document?.failureMessage).toContain(`/documents/${documentId}/original`);
    queue.reset();
  });
});
