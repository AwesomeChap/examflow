import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireStudent } from "../middleware/auth.js";

export const studentRouter = Router();

// Student area: only students reach these routes (staff get 403).
studentRouter.use(requireAuth, requireStudent);

type AttemptStatus = "not_started" | "in_progress" | "submitted";

// The student's home view: every exam assigned to them, with its open time,
// whether it is currently open, and the state of their own attempt. The client
// uses `isOpen` / `startsInMs` to lock exams that haven't started yet.
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
        _count: { select: { questions: true } },
      },
    }),
    prisma.attempt.findMany({
      where: { userId: studentId },
      select: { examId: true, submittedAt: true, score: true },
    }),
  ]);

  const attemptByExam = new Map(attempts.map((a) => [a.examId, a]));
  const now = Date.now();

  const dashboard = exams.map((exam) => {
    const attempt = attemptByExam.get(exam.id);
    const status: AttemptStatus = !attempt
      ? "not_started"
      : attempt.submittedAt
        ? "submitted"
        : "in_progress";

    const isOpen = !exam.startsAt || now >= exam.startsAt.getTime();

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
      score: attempt?.submittedAt ? attempt.score : null,
    };
  });

  res.json({ exams: dashboard });
});
