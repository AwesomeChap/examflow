import { Router } from "express";
import type { CookieOptions, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { signAuthToken, verifyPassword } from "../lib/auth.js";
import { env } from "../lib/env.js";
import { sendError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { parseOr400 } from "../lib/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { loginSchema } from "../validation/schemas.js";
import { getCurrentUser } from "./me.js";

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    // In production the frontend and API are served from different domains
    // (e.g. *.onrender.com), so the auth cookie is cross-site. Browsers only
    // send a cross-site cookie when it is `SameSite=None; Secure`. Locally the
    // client is same-origin enough for `Lax`, which also works without HTTPS.
    sameSite: env.isProduction ? "none" : "lax",
    path: "/",
    maxAge: ONE_DAY_MS,
  };
}

export const authRouter = Router();

// Throttle credential-guessing on login. Enforced in production only; local dev
// and the test suite (which log in many times) are skipped so they aren't
// rate-limited. Relies on `trust proxy` (set in app.ts) for the real client IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => !env.isProduction,
  message: { error: "Too many login attempts. Please try again later." },
});

authRouter.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const data = parseOr400(loginSchema, req.body, res);
  if (!data) return;

  const identifier = (data.identifier ?? data.email)!.trim();

  // Match either the email or the matriculation number (case-insensitive).
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: identifier, mode: "insensitive" } },
        { matriculationNumber: { equals: identifier, mode: "insensitive" } },
      ],
    },
  });

  // Any active account with a password may log in (admin, teacher, or
  // student). Deactivated accounts are rejected with the same generic message.
  if (!user || !user.passwordHash || user.deactivatedAt) {
    sendError(res, 401, "Invalid credentials");
    return;
  }

  const passwordValid = await verifyPassword(data.password, user.passwordHash);
  if (!passwordValid) {
    sendError(res, 401, "Invalid credentials");
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
      matriculationNumber: user.matriculationNumber,
    },
  });
});

authRouter.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(env.authCookieName, { ...cookieOptions(), maxAge: undefined });
  res.json({ success: true });
});

// Backward-compatible alias for the canonical `/me` endpoint.
authRouter.get("/me", requireAuth, getCurrentUser);
