import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { resetStore } from "./db/schema.js";

const app = createApp();

afterEach(() => resetStore());

describe("DischargeGuide API", () => {
  it("reports placeholder integration status", async () => {
    const response = await request(app).get("/health").expect(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.integrations).toEqual(
      expect.arrayContaining([expect.objectContaining({ mode: "mock" })])
    );
  });

  it("accepts a supported document and completes the placeholder pipeline", async () => {
    const upload = await request(app)
      .post("/upload")
      .attach("document", Buffer.from("placeholder pdf"), {
        filename: "instructions.pdf",
        contentType: "application/pdf"
      })
      .expect(202);

    expect(upload.body.documentId).toBeTypeOf("string");
    await new Promise((resolve) => setTimeout(resolve, 300));

    const medications = await request(app)
      .get("/medications")
      .query({ documentId: upload.body.documentId })
      .expect(200);
    expect(medications.body).toEqual({ data: [], isPlaceholder: true });

    const answer = await request(app)
      .post("/ask")
      .send({ documentId: upload.body.documentId, question: "When do I take my medicine?" })
      .expect(200);
    expect(answer.body.confidence).toBe(0);
    expect(answer.body.warning).toBe("Please check the original document.");
    expect(answer.body.sourceLines).toEqual([]);
  });

  it("rejects unsupported uploads", async () => {
    await request(app)
      .post("/upload")
      .attach("document", Buffer.from("text"), {
        filename: "notes.txt",
        contentType: "text/plain"
      })
      .expect(415);
  });

  it("stores accessibility preferences", async () => {
    const preferences = {
      textSize: "very_large",
      darkMode: true,
      highContrast: true,
      reduceMotion: true,
      voiceReading: true
    };
    await request(app).post("/accessibility/prefs").send(preferences).expect(200);
    const response = await request(app).get("/accessibility/prefs").expect(200);
    expect(response.body).toEqual(preferences);
  });
});
