import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { repository } from "../db/repository.js";
import { AppError, unauthorized } from "../errors.js";
import { createTokens, hashToken } from "../middleware/auth.js";

const credentials = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

interface RefreshClaims {
  sub: string;
  type: "refresh";
}

async function issueSession(userId: string, email: string) {
  const tokens = createTokens(userId);
  repository.createSession(
    userId,
    await hashToken(tokens.refreshToken),
    new Date(Date.now() + tokens.refreshExpiresInSeconds * 1_000).toISOString(),
  );
  return { user: { id: userId, email }, ...tokens };
}

function verifyRefreshToken(raw: string): string {
  let claims: RefreshClaims;
  try {
    claims = jwt.verify(raw, config.JWT_REFRESH_SECRET) as RefreshClaims;
  } catch {
    throw unauthorized("Invalid or expired refresh token");
  }
  if (claims.type !== "refresh" || !claims.sub) {
    throw unauthorized("Invalid refresh token");
  }
  return claims.sub;
}

export const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success)
      throw new AppError(
        400,
        "Valid email and 12+ character password required",
        "INVALID_INPUT",
      );
    if (repository.findUserByEmail(parsed.data.email)) {
      throw new AppError(
        409,
        "An account with that email already exists",
        "EMAIL_EXISTS",
      );
    }
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = repository.createUser(parsed.data.email, passwordHash);
    res.status(201).json(await issueSession(user.id, user.email));
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success)
      throw new AppError(400, "Valid credentials required", "INVALID_INPUT");
    const user = repository.findUserByEmail(parsed.data.email);
    if (
      !user ||
      !(await bcrypt.compare(parsed.data.password, user.passwordHash))
    ) {
      throw new AppError(
        401,
        "Email or password is incorrect",
        "INVALID_CREDENTIALS",
      );
    }
    res.json(await issueSession(user.id, user.email));
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success)
      throw new AppError(400, "A refresh token is required", "INVALID_INPUT");
    const userId = verifyRefreshToken(parsed.data.refreshToken);
    const user = repository.findUserById(userId);
    const sessions = repository.listSessionsForUser(userId);
    const session = (
      await Promise.all(
        sessions.map(async (candidate) =>
          (await bcrypt.compare(
            parsed.data.refreshToken,
            candidate.refreshTokenHash,
          ))
            ? candidate
            : null,
        ),
      )
    ).find((candidate) => candidate !== null);
    if (!session || !user || session.expiresAt <= new Date().toISOString()) {
      // A present-but-unmatched session means the token was already rotated
      // or revoked (reuse). Revoke the whole session family and reject.
      repository.deleteSessionsForUser(userId);
      throw unauthorized("Session expired or revoked");
    }
    repository.deleteSession(session.id);
    res.json(await issueSession(user.id, user.email));
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      res.sendStatus(204);
      return;
    }
    const claims = jwt.decode(parsed.data.refreshToken) as RefreshClaims | null;
    if (claims?.sub) {
      for (const candidate of repository.listSessionsForUser(claims.sub)) {
        if (
          await bcrypt.compare(
            parsed.data.refreshToken,
            candidate.refreshTokenHash,
          )
        ) {
          repository.deleteSession(candidate.id);
          break;
        }
      }
    }
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});
