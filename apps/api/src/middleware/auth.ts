import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { unauthorized } from "../errors.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

interface AccessClaims {
  sub: string;
  type: "access";
}

export function createTokens(userId: string) {
  return {
    accessToken: jwt.sign({ type: "access" }, config.JWT_ACCESS_SECRET, {
      subject: userId,
      expiresIn: "15m"
    }),
    refreshToken: jwt.sign({ type: "refresh" }, config.JWT_REFRESH_SECRET, {
      subject: userId,
      expiresIn: "7d"
    }),
    accessExpiresInSeconds: 15 * 60,
    refreshExpiresInSeconds: 7 * 24 * 60 * 60
  };
}

export async function hashToken(token: string) {
  return bcrypt.hash(token, 10);
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authorization = req.header("authorization");
    if (!authorization?.startsWith("Bearer ")) throw unauthorized();
    const claims = jwt.verify(authorization.slice(7), config.JWT_ACCESS_SECRET) as AccessClaims;
    if (claims.type !== "access" || !claims.sub) throw unauthorized("Invalid access token");
    req.userId = claims.sub;
    next();
  } catch (error) {
    next(error instanceof Error && "statusCode" in error ? error : unauthorized("Invalid access token"));
  }
}
