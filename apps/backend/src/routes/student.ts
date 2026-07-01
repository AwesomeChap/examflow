import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireStudent } from "../middleware/auth.js";

export const studentRouter = Router();

// Student area: only students reach these routes (staff get 403).
studentRouter.use(requireAuth, requireStudent);

type AttemptStatus = "not_started" | "in_progress" | "submitted";

type StudentAttempt = {
  id: string;
  examId: string;
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
};

// Best submitted attempt for an exam (highest score, tie-break latest).
function bestSubmitted(attempts: StudentAttempt[]): StudentAttempt | null {
  const submitted = attempts.filter((a) => a.submittedAt !== null);
  if (submitted.length === 0) return null;
  return submitted.reduce((best, a) => {
    const bs = best.score ?? 0;
    const as = a.score ?? 0;
    if (as > bs) return a;
    if (as === bs && a.submittedAt! > best.submittedAt!) return a;
    return best;
  });
}

// The student's home view: every exam assigned to them, with its open time,
// whether it is currently open, and the state of their attempts (best score,
// how many attempts remain). The client uses `isOpen` / `startsInMs` to lock
// exams that haven't started yet.
studentRouter.get("/dashboard", async (req: Request, res: Response) => {
  const studentId = req.user!.sub;

  const [exams, attempts] = await Promise.all([
    prisma.exam.findMany({
      where: { assignments: { some: { studentId } } },
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        durationMin: true,
        startsAt: true,
        maxAttempts: true,
        _count: { select: { questions: true } },
      },
    }),
    prisma.attempt.findMany({
      where: { userId: studentId },
      select: { id: true, examId: true, startedAt: true, submittedAt: true, score: true },
    }),
  ]);

  const attemptsByExam = new Map<string, StudentAttempt[]>();
  for (const a of attempts) {
    const list = attemptsByExam.get(a.examId) ?? [];
    list.push(a);
    attemptsByExam.set(a.examId, list);
  }

  const now = Date.now();

  const dashboard = exams.map((exam) => {
    const examAttempts = attemptsByExam.get(exam.id) ?? [];
    const hasActive = examAttempts.some((a) => a.submittedAt === null);
    const best = bestSubmitted(examAttempts);

    const status: AttemptStatus = hasActive
      ? "in_progress"
      : best
        ? "submitted"
        : "not_started";

    const isOpen = !exam.startsAt || now >= exam.startsAt.getTime();
    const attemptsUsed = examAttempts.length;
    const attemptsRemaining =
      exam.maxAttempts === null ? null : Math.max(0, exam.maxAttempts - attemptsUsed);

    return {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      durationMin: exam.durationMin,
      startsAt: exam.startsAt,
      totalQuestions: exam._count.questions,
      isOpen,
      startsInMs:
        exam.startsAt && !isOpen ? exam.startsAt.getTime() - now : null,
      attemptStatus: status,
      score: best ? best.score : null,
      maxAttempts: exam.maxAttempts,
      attemptsUsed,
      attemptsRemaining,
      bestAttemptId: best ? best.id : null,
    };
  });

  res.json({ exams: dashboard });
});

// A flat list of the student's submitted attempts across all exams (newest
// first), for the Results tab. Each attempt links to its own breakdown.
studentRouter.get("/results", async (req: Request, res: Response) => {
  const studentId = req.user!.sub;

  const attempts = await prisma.attempt.findMany({
    where: { userId: studentId, submittedAt: { not: null } },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      examId: true,
      startedAt: true,
      submittedAt: true,
      score: true,
      exam: {
        select: {
          title: true,
          questions: { select: { points: true } },
        },
      },
    },
  });

  // Attempt number is the chronological position among the student's attempts
  // for that exam. Compute per-exam ordering by startedAt.
  const orderByExam = new Map<string, string[]>();
  const chronological = [...attempts].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
  );
  for (const a of chronological) {
    const list = orderByExam.get(a.examId) ?? [];
    list.push(a.id);
    orderByExam.set(a.examId, list);
  }

  const results = attempts.map((a) => {
    const maxScore = a.exam.questions.reduce((sum, q) => sum + q.points, 0);
    const score = a.score ?? 0;
    const attemptNumber = (orderByExam.get(a.examId)?.indexOf(a.id) ?? 0) + 1;
    return {
      id: a.id,
      examId: a.examId,
      title: a.exam.title,
      attemptNumber,
      score,
      maxScore,
      percentage: maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0,
      submittedAt: a.submittedAt,
    };
  });

  res.json({ results });
});
