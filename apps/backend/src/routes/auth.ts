import { Router } from "express";
import type { CookieOptions, Request, Response } from "express";
import { signAuthToken, verifyPassword } from "../lib/auth.js";
import { env } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { getCurrentUser } from "./me.js";

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_DAY_MS,
  };
}

export const authRouter = Router();

authRouter.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  // Login is restricted to staff accounts (admin/teacher) with a password set.
  if (!user || !user.passwordHash || user.role === "student") {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signAuthToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  res.cookie(env.authCookieName, token, cookieOptions());
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

authRouter.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(env.authCookieName, { ...cookieOptions(), maxAge: undefined });
  res.json({ success: true });
});

// Backward-compatible alias for the canonical `/me` endpoint.
authRouter.get("/me", requireAuth, getCurrentUser);
