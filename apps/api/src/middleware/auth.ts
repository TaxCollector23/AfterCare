import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

// Development placeholder. Replace with verified JWT middleware before production.
export function auth(req: Request, _res: Response, next: NextFunction) {
  req.userId = req.header("x-user-id") ?? "demo-user";
  next();
}
