import { Router } from "express";
import type { Request, Response } from "express";
import { sendError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { userPublicSelect } from "../lib/userSelect.js";
import { requireAuth } from "../middleware/auth.js";

// Shared handler so `/me` and the legacy `/auth/me` stay in sync.
export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: userPublicSelect,
  });

  if (!user) {
    sendError(res, 404, "User not found");
    return;
  }

  // A session that outlives its account being deactivated must not resolve;
  // ending it here forces re-login (which the login route then blocks).
  if (user.deactivatedAt) {
    sendError(res, 401, "Account deactivated");
    return;
  }

  const { deactivatedAt: _deactivatedAt, ...publicUser } = user;
  res.json({ user: publicUser });
}

export const meRouter = Router();

meRouter.get("/", requireAuth, getCurrentUser);
