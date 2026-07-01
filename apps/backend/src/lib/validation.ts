import type { Response } from "express";
import type { ZodError, ZodType } from "zod";
import { sendError } from "./http.js";

export function formatZodError(error: ZodError): {
  path: string;
  message: string;
}[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

/**
 * Parses `body` with the given schema. On failure, sends a 400 response with
 * structured details and returns `null` so the caller can simply `return`.
 */
export function parseOr400<T>(schema: ZodType<T>, body: unknown, res: Response): T | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    sendError(res, 400, "Validation failed", {
      details: formatZodError(result.error),
    });
    return null;
  }
  return result.data;
}
