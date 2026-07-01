import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { env } from "./lib/env.js";
import { sendError } from "./lib/http.js";
import { openApiDocument } from "./openapi.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { examsRouter } from "./routes/exams.js";
import { meRouter } from "./routes/me.js";
import { studentRouter } from "./routes/student.js";
import { studentsRouter } from "./routes/students.js";
import { teacherRouter } from "./routes/teacher.js";

export function createApp() {
  const app = express();

  // Allow the browser client to send/receive the HttpOnly auth cookie across
  // origins (e.g. Vite dev server -> API). `credentials` is required for cookies.
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // API documentation: raw OpenAPI spec + interactive Swagger UI.
  app.get("/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument as swaggerUi.JsonObject, {
      customSiteTitle: "ExamFlow API docs",
    }),
  );

  app.use("/auth", authRouter);
  app.use("/me", meRouter);
  app.use("/admin", adminRouter);
  app.use("/teacher", teacherRouter);
  app.use("/student", studentRouter);
  app.use("/students", studentsRouter);
  app.use("/exams", examsRouter);

  // JSON fallback for any unhandled error (Express 5 forwards async throws here).
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    if (res.headersSent) return;
    sendError(res, 500, "Internal server error");
  });

  return app;
}
