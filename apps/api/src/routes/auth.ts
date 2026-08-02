import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { repository } from "../db/repository.js";
import { AppError } from "../errors.js";
import { createTokens, hashToken } from "../middleware/auth.js";

const credentials = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
});

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
    req.userId = user.id;
    const tokens = createTokens(user.id);
    repository.createSession(
      user.id,
      await hashToken(tokens.refreshToken),
      new Date(
        Date.now() + tokens.refreshExpiresInSeconds * 1_000,
      ).toISOString(),
    );
    res
      .status(201)
      .json({ user: { id: user.id, email: user.email }, ...tokens });
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
    req.userId = user.id;
    const tokens = createTokens(user.id);
    repository.createSession(
      user.id,
      await hashToken(tokens.refreshToken),
      new Date(
        Date.now() + tokens.refreshExpiresInSeconds * 1_000,
      ).toISOString(),
    );
    res.json({ user: { id: user.id, email: user.email }, ...tokens });
  } catch (error) {
    next(error);
  }
});
