import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
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

  // Render (and most PaaS) terminate TLS at a proxy and forward requests over
  // HTTP with an `X-Forwarded-Proto` header. Trusting the proxy lets Express
  // recognize the original request as secure, which `Secure` cookies rely on.
  app.set("trust proxy", 1);

  // Baseline security headers (HSTS, no-sniff, frameguard, etc.). CSP is
  // disabled because this service only serves JSON + the Swagger UI docs (whose
  // inline assets a strict default CSP would block); the SPA is a separate
  // static site with its own headers.
  app.use(helmet({ contentSecurityPolicy: false }));

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
