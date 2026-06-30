import cookieParser from "cookie-parser";
import express from "express";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { meRouter } from "./routes/me.js";
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

  return app;
}
