import type { Response } from "express";
import { Prisma } from "../generated/prisma/client.js";

/**
 * Maps common Prisma errors to HTTP responses.
 * Returns `true` if the error was handled (response sent), otherwise `false`
 * so the caller can rethrow and let the global error handler take over.
 */
export function handleKnownPrismaError(
  error: unknown,
  res: Response,
): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2025":
        res.status(404).json({ error: "Resource not found" });
        return true;
      case "P2002":
        res.status(409).json({
          error: "A record with these values already exists",
          target: error.meta?.target,
        });
        return true;
      case "P2003":
        res.status(409).json({ error: "Related record constraint failed" });
        return true;
    }
  }
  return false;
}
