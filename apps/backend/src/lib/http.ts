import type { Response } from "express";
import { Prisma } from "../generated/prisma/client.js";

/**
 * Standard JSON error response: `{ error: <message>, ...extra }`.
 * Single helper so every endpoint returns the same error envelope.
 */
export function sendError(
  res: Response,
  status: number,
  message: string,
  extra?: Record<string, unknown>,
): void {
  res.status(status).json({ error: message, ...extra });
}

/**
 * Maps common Prisma errors to HTTP responses.
 * Returns `true` if the error was handled (response sent), otherwise `false`
 * so the caller can rethrow and let the global error handler take over.
 */
export function handleKnownPrismaError(error: unknown, res: Response): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2025":
        sendError(res, 404, "Resource not found");
        return true;
      case "P2002":
        sendError(res, 409, "A record with these values already exists", {
          target: error.meta?.target,
        });
        return true;
      case "P2003":
        sendError(res, 409, "Related record constraint failed");
        return true;
    }
  }
  return false;
}
