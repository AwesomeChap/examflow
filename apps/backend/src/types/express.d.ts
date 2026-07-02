import type { ExamStatus } from "@examflow/shared-types";
import type { AuthTokenPayload } from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
      exam?: { id: string; createdById: string; status: ExamStatus };
    }
  }
}

export {};
