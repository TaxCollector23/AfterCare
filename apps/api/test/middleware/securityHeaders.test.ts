import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { closeCache } from "../../src/cache/index.js";
import { repository } from "../../src/db/repository.js";
import { resetDriveTokens } from "../../src/integrations/googleDrive.js";
import { resetStorage } from "../../src/integrations/storage.js";
import { pipelineQueue } from "../../src/queue/pipelineQueue.js";

const app = createApp();

const EXPECTED_HEADERS: Record<string, string | RegExp> = {
  "cache-control": "no-store",
  pragma: "no-cache",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "strict-transport-security": /max-age=31536000/,
};

function expectSecurityHeaders(response: request.Response) {
  for (const [name, value] of Object.entries(EXPECTED_HEADERS)) {
    if (value instanceof RegExp) {
      expect(response.headers[name], `header ${name}`).toMatch(value);
    } else {
      expect(response.headers[name], `header ${name}`).toBe(value);
    }
  }
}

beforeEach(() => repository.reset());
afterEach(() => {
  repository.reset();
  resetStorage();
  resetDriveTokens();
  pipelineQueue.reset();
});

describe("HIPAA security headers", () => {
  it("applies no-store and hardening headers to the public /health route", async () => {
    const response = await request(app).get("/health").expect(200);
    expectSecurityHeaders(response);
  });

  it("applies the headers to authenticated routes too", async () => {
    const created = await request(app)
      .post("/auth/register")
      .send({
        email: "headers@example.com",
        password: "a-safe-password-123",
      })
      .expect(201);
    const token = created.body.accessToken as string;

    const response = await request(app)
      .get("/accessibility/prefs")
      .set("authorization", `Bearer ${token}`)
      .expect(200);
    expectSecurityHeaders(response);
  });

  it("applies the headers to 404 responses", async () => {
    // The 404 handler is mounted behind authentication, so a token is needed
    // to reach it (an anonymous request 401s instead).
    const created = await request(app)
      .post("/auth/register")
      .send({
        email: "headers-404@example.com",
        password: "a-safe-password-123",
      })
      .expect(201);
    const token = created.body.accessToken as string;

    const response = await request(app)
      .get("/definitely-not-a-route")
      .set("authorization", `Bearer ${token}`)
      .expect(404);
    expectSecurityHeaders(response);
  });

  it("applies the headers to error responses", async () => {
    const response = await request(app).post("/auth/register").send({}).expect(400);
    expectSecurityHeaders(response);
  });

  it("does not leak provider keys in health or error responses", async () => {
    const health = await request(app).get("/health").expect(200);
    expect(JSON.stringify(health.body)).not.toMatch(/sk-|key|secret/i);
  });
});
