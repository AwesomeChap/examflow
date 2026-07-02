import type { NextFunction, Request, Response } from "express";
import { canWriteExam } from "../lib/examAccess.js";
import { sendError } from "../lib/http.js";
import { param } from "../lib/params.js";
import { prisma } from "../lib/prisma.js";

/**
 * Loads the exam referenced by `:examId` into `req.exam` (id, owner, status).
 * Responds 404 if it doesn't exist. Use on any exam-scoped route.
 */
export async function loadExam(req: Request, res: Response, next: NextFunction): Promise<void> {
  const exam = await prisma.exam.findUnique({
    where: { id: param(req, "examId") },
    select: { id: true, createdById: true, status: true },
  });

  if (!exam) {
    sendError(res, 404, "Exam not found");
    return;
  }

  req.exam = exam;
  next();
}

/**
 * Requires write access (admin or owning teacher) to the already-loaded
 * `req.exam`. Must run after `loadExam` (and typically `requireStaff`).
 * Responds 404 rather than 403 to avoid leaking the exam's existence.
 */
export function requireExamWrite(req: Request, res: Response, next: NextFunction): void {
  if (!req.exam || !canWriteExam(req.user!, req.exam)) {
    sendError(res, 404, "Exam not found");
    return;
  }
  next();
}
