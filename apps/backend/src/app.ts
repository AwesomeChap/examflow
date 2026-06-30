import cookieParser from "cookie-parser";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { sendError } from "./lib/http.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { examsRouter } from "./routes/exams.js";
import { meRouter } from "./routes/me.js";
import { studentRouter } from "./routes/student.js";
import { teacherRouter } from "./routes/teacher.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRouter);
  app.use("/me", meRouter);
  app.use("/admin", adminRouter);
  app.use("/teacher", teacherRouter);
  app.use("/student", studentRouter);
  app.use("/exams", examsRouter);

  // JSON fallback for any unhandled error (Express 5 forwards async throws here).
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    if (res.headersSent) return;
    sendError(res, 500, "Internal server error");
  });

  return app;
}
