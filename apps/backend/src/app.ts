import cookieParser from "cookie-parser";
import express from "express";
import type { Request, Response } from "express";
import { requireAuth, requireRole } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRouter);

  // Example protected route: any authenticated staff member.
  app.get(
    "/admin/overview",
    requireAuth,
    requireRole("admin", "teacher"),
    (req: Request, res: Response) => {
      res.json({
        message: `Welcome, ${req.user!.email}`,
        role: req.user!.role,
      });
    },
  );

  return app;
}
