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

  const [exam, questions, attempts, assignedStudents] = await Promise.all([
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
      select: {
        id: true,
        userId: true,
        startedAt: true,
        submittedAt: true,
        score: true,
      },
    }),
    prisma.examAssignment.count({ where: { examId } }),
  ]);

  if (!exam) {
    sendError(res, 404, "Exam not found");
    return;
  }

  // With multiple attempts allowed, each student's *best* submitted attempt is
  // the one that counts (highest score, tie-break latest). Analytics reflect
  // one counting attempt per student.
  const bestByUser = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) {
    if (!a.submittedAt) continue;
    const current = bestByUser.get(a.userId);
    if (
      !current ||
      (a.score ?? 0) > (current.score ?? 0) ||
      ((a.score ?? 0) === (current.score ?? 0) &&
        a.submittedAt > current.submittedAt!)
    ) {
      bestByUser.set(a.userId, a);
    }
  }
  const countingAttempts = [...bestByUser.values()];
  const countingIds = new Set(countingAttempts.map((a) => a.id));

  // Only graded answers from the counting attempts feed correctness stats.
  const answers = await prisma.answer.findMany({
    where: { attemptId: { in: [...countingIds] } },
    select: { questionId: true, isCorrect: true },
  });

  // Summary counts describe every attempt (including retakes / in-progress).
  const submittedTotal = attempts.filter((a) => a.submittedAt !== null).length;
  const attemptTotals = {
    total: attempts.length,
    inProgress: attempts.length - submittedTotal,
  };

  res.json({
    analytics: buildExamAnalytics(
      exam,
      questions,
      countingAttempts,
      answers,
      assignedStudents,
      attemptTotals,
    ),
  });
});
