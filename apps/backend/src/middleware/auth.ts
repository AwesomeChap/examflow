import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../generated/prisma/client.js";
import { verifyAuthToken } from "../lib/auth.js";
import { env } from "../lib/env.js";
import { sendError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[env.authCookieName] as string | undefined;

  if (!token) {
    sendError(res, 401, "Authentication required");
    return;
  }

  let payload;
  try {
    payload = verifyAuthToken(token);
  } catch {
    sendError(res, 401, "Invalid or expired token");
    return;
  }

  // Revalidate against the live account on every request. The token is valid
  // for its whole lifetime (~1 day), but the account may have been deactivated
  // or had its role changed since it was issued; trusting the token blindly
  // would let a revoked/downgraded user keep acting until it expired. We also
  // re-read the role here so downstream role guards use the current value.
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, deactivatedAt: true },
  });

  if (!user || user.deactivatedAt) {
    sendError(res, 401, "Invalid or expired token");
    return;
  }

  req.user = { sub: user.id, email: user.email, role: user.role };
  next();
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
