import type { AuthTokenPayload } from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
      exam?: { id: string; createdById: string };
    }
  }
}

export {};
