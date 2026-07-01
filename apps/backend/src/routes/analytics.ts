import { Router } from "express";
import type { Request, Response } from "express";
import { buildExamAnalytics } from "../lib/analytics.js";
import { sendError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { requireStaff } from "../middleware/auth.js";
import { loadExam, requireExamWrite } from "../middleware/exam.js";

// Nested under /exams/:examId/analytics. Inherits requireAuth from the parent
// exams router; analytics are owner-scoped, so we reuse the same staff + exam
// write guard used by exam mutations (admin or the owning teacher only).
export const analyticsRouter = Router({ mergeParams: true });

analyticsRouter.use(requireStaff, loadExam, requireExamWrite);

// Per-exam analytics: attempt summary, average score, score distribution, and
// per-question correctness rates.
analyticsRouter.get("/", async (req: Request, res: Response) => {
  const examId = req.exam!.id;

  const [exam, questions, attempts, answers, assignedStudents] =
    await Promise.all([
      prisma.exam.findUnique({
        where: { id: examId },
        select: { id: true, title: true },
      }),
      prisma.question.findMany({
        where: { examId },
        orderBy: { order: "asc" },
        select: { id: true, order: true, text: true, type: true, points: true },
      }),
      prisma.attempt.findMany({
        where: { examId },
        select: { startedAt: true, submittedAt: true, score: true },
      }),
      // Only graded answers from submitted attempts feed correctness stats.
      prisma.answer.findMany({
        where: { attempt: { examId, submittedAt: { not: null } } },
        select: { questionId: true, isCorrect: true },
      }),
      prisma.examAssignment.count({ where: { examId } }),
    ]);

  if (!exam) {
    sendError(res, 404, "Exam not found");
    return;
  }

  res.json({
    analytics: buildExamAnalytics(
      exam,
      questions,
      attempts,
      answers,
      assignedStudents,
    ),
  });
});
