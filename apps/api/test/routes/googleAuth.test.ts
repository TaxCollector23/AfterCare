import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { repository } from "../../src/db/repository.js";
import { AppError } from "../../src/errors.js";
import type { GoogleIdentity } from "../../src/integrations/googleIdentity.js";

const identity = (overrides: Partial<GoogleIdentity> = {}): GoogleIdentity => ({
  googleId: "google-sub-1",
  email: "patient@example.com",
  emailVerified: true,
  ...overrides,
});

function appWith(verify: (idToken: string) => Promise<GoogleIdentity>) {
  return createApp({ verifyGoogleIdToken: verify });
}

afterEach(() => {
  repository.reset();
});

describe("POST /auth/google", () => {
  it("creates an account on a first Google sign-in", async () => {
    const app = appWith(async () => identity());

    const res = await request(app)
      .post("/auth/google")
      .send({ idToken: "valid-token" });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("patient@example.com");
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it("issues a session without storing a password", async () => {
    const app = appWith(async () => identity());
    await request(app).post("/auth/google").send({ idToken: "valid-token" });

    const user = repository.findUserByEmail("patient@example.com");
    expect(user?.passwordHash).toBeNull();
    expect(user?.provider).toBe("google");
  });

  it("signs an existing Google account back in rather than duplicating it", async () => {
    const app = appWith(async () => identity());

    const first = await request(app).post("/auth/google").send({ idToken: "t" });
    const second = await request(app).post("/auth/google").send({ idToken: "t" });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.user.id).toBe(first.body.user.id);
  });

  it("signs in to an existing password account with the same verified address", async () => {
    // Same person, same proven address — link rather than refuse or duplicate.
    const app = appWith(async () => identity());
    const existing = repository.createUser("patient@example.com", "hash", "password");

    const res = await request(app).post("/auth/google").send({ idToken: "t" });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(existing.id);
    // The existing password must survive, so they can still use either door.
    expect(repository.findUserByEmail("patient@example.com")?.passwordHash).toBe("hash");
  });

  it("rejects a token the verifier refuses", async () => {
    const app = appWith(async () => {
      throw new AppError(401, "Google sign-in failed.", "INVALID_GOOGLE_TOKEN");
    });

    const res = await request(app).post("/auth/google").send({ idToken: "forged" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_GOOGLE_TOKEN");
    expect(repository.findUserByEmail("patient@example.com")).toBeUndefined();
  });

  it("refuses an unverified Google email address", async () => {
    const app = appWith(async () => {
      throw new AppError(
        403,
        "Your Google email address isn't verified.",
        "GOOGLE_EMAIL_UNVERIFIED",
      );
    });

    const res = await request(app).post("/auth/google").send({ idToken: "t" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("GOOGLE_EMAIL_UNVERIFIED");
  });

  it("requires an ID token", async () => {
    const verify = vi.fn();
    const app = appWith(verify);

    const res = await request(app).post("/auth/google").send({});

    expect(res.status).toBe(400);
    expect(verify).not.toHaveBeenCalled();
  });

  it("never reflects the submitted token back in the response", async () => {
    const app = appWith(async () => {
      throw new AppError(401, "Google sign-in failed.", "INVALID_GOOGLE_TOKEN");
    });

    const res = await request(app)
      .post("/auth/google")
      .send({ idToken: "super-secret-token-value" });

    expect(JSON.stringify(res.body)).not.toContain("super-secret-token-value");
  });
});

describe("POST /auth/login for a Google account", () => {
  it("points the user at Google instead of failing generically", async () => {
    const app = appWith(async () => identity());
    await request(app).post("/auth/google").send({ idToken: "t" });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "patient@example.com", password: "any-long-password-1234" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("USE_GOOGLE_SIGN_IN");
    expect(res.body.error).toMatch(/Google/);
  });
});
