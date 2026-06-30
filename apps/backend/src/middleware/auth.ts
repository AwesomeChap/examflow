import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../generated/prisma/client.js";
import { verifyAuthToken } from "../lib/auth.js";
import { env } from "../lib/env.js";
import { sendError } from "../lib/http.js";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.[env.authCookieName] as string | undefined;

  if (!token) {
    sendError(res, 401, "Authentication required");
    return;
  }

  try {
    req.user = verifyAuthToken(token);
    next();
  } catch {
    sendError(res, 401, "Invalid or expired token");
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, "Authentication required");
      return;
    }

    if (!roles.includes(req.user.role)) {
      sendError(res, 403, "Insufficient permissions");
      return;
    }

    next();
  };
}

// Convenience guards for the three roles. Each must run after `requireAuth`.
// `requireStaff` treats admin as a superset of teacher (admin can do anything
// a teacher can). Use the generic `requireRole(...)` for any custom combination.
export const requireAdmin = requireRole("admin");
export const requireStaff = requireRole("admin", "teacher");
export const requireStudent = requireRole("student");
