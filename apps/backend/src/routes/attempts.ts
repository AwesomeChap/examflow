import { Router } from "express";
import type { Request, Response } from "express";
import {
  attemptDeadline,
  buildAttemptResult,
  finalizeAttempt,
  isAttemptExpired,
  isValidAnswerValue,
  presentAttempt,
} from "../lib/attempt.js";
import { canReadExam } from "../lib/examAccess.js";
import { handleKnownPrismaError, sendError } from "../lib/http.js";
import { param } from "../lib/params.js";
import { prisma } from "../lib/prisma.js";
import { parseOr400 } from "../lib/validation.js";
import { requireStudent } from "../middleware/auth.js";
import { answerUpsertSchema } from "../validation/schemas.js";

// Nested under /exams/:examId/attempt (active-attempt flow) and
// /exams/:examId/attempts (attempt history + per-attempt results). Both inherit
// requireAuth from the parent exams router; here we restrict to students.
export const attemptsRouter = Router({ mergeParams: true });
export const attemptsListRouter = Router({ mergeParams: true });

attemptsRouter.use(requireStudent);
attemptsListRouter.use(requireStudent);

type ExamContext = {
  id: string;
  createdById: string;
  durationMin: number;
  startsAt: Date | null;
  maxAttempts: number | null;
};

// Loads the exam (with its time limit + attempt policy) and confirms the
// student is allowed to read it (i.e. is assigned). Returns null after sending a
// 404 on failure so existence is never leaked.
async function loadExamContext(req: Request, res: Response): Promise<ExamContext | null> {
  const exam = await prisma.exam.findUnique({
    where: { id: param(req, "examId") },
    select: {
      id: true,
      createdById: true,
      durationMin: true,
      startsAt: true,
      maxAttempts: true,
    },
  });

  if (!exam || !(await canReadExam(req.user!, exam))) {
    sendError(res, 404, "Exam not found");
    return null;
  }
  return exam;
}

// The single in-progress (unsubmitted) attempt for a student, if any.
function findActiveAttempt(examId: string, userId: string) {
  return prisma.attempt.findFirst({
    where: { examId, userId, submittedAt: null },
    orderBy: { startedAt: "desc" },
  });
}

function countUserAttempts(examId: string, userId: string) {
  return prisma.attempt.count({ where: { examId, userId } });
}

function listAnswers(attemptId: string) {
  return prisma.answer.findMany({ where: { attemptId } });
}

// Start a new attempt, or resume the active one. Enforces the exam's
// maxAttempts policy (null = unlimited). In-progress attempts count toward the
// limit, so starting consumes an attempt.
attemptsRouter.post("/", async (req: Request, res: Response) => {
  const exam = await loadExamContext(req, res);
  if (!exam) return;

  // Scheduled exams cannot be started before their open time.
  if (exam.startsAt && Date.now() < exam.startsAt.getTime()) {
    sendError(res, 403, "Exam has not started yet", {
      startsAt: exam.startsAt,
    });
    return;
  }

  const userId = req.user!.sub;
  const active = await findActiveAttempt(exam.id, userId);

  if (active) {
    if (!isAttemptExpired(active.startedAt, exam.durationMin)) {
      // Resuming an in-progress attempt is idempotent.
      const answers = await listAnswers(active.id);
      res.json({ attempt: presentAttempt(active, exam.durationMin, answers) });
      return;
    }
    // The active attempt's time ran out while it was open: auto-submit it. It
    // still counts against the limit below.
    await finalizeAttempt(active, {
      submittedAt: attemptDeadline(active.startedAt, exam.durationMin),
    });
  }

  const used = await countUserAttempts(exam.id, userId);
  if (exam.maxAttempts !== null && used >= exam.maxAttempts) {
    sendError(res, 409, "No attempts remaining");
    return;
  }

  try {
    const attempt = await prisma.attempt.create({
      data: { examId: exam.id, userId },
    });
    res.status(201).json({ attempt: presentAttempt(attempt, exam.durationMin, []) });
  } catch (error) {
    if (handleKnownPrismaError(error, res)) return;
    throw error;
  }
});

// Read the active attempt state (auto-finalizes if the time limit passed).
attemptsRouter.get("/", async (req: Request, res: Response) => {
  const exam = await loadExamContext(req, res);
  if (!exam) return;

  const attempt = await findActiveAttempt(exam.id, req.user!.sub);
  if (!attempt) {
    sendError(res, 404, "Attempt not found");
    return;
  }

  let current = attempt;
  if (isAttemptExpired(attempt.startedAt, exam.durationMin)) {
    current = await finalizeAttempt(attempt, {
      submittedAt: attemptDeadline(attempt.startedAt, exam.durationMin),
    });
  }

  const answers = await listAnswers(current.id);
  res.json({ attempt: presentAttempt(current, exam.durationMin, answers) });
});

// Store / update the answer to one question during the active attempt.
attemptsRouter.put("/answers/:questionId", async (req: Request, res: Response) => {
  const exam = await loadExamContext(req, res);
  if (!exam) return;

  const data = parseOr400(answerUpsertSchema, req.body, res);
  if (!data) return;

  const attempt = await findActiveAttempt(exam.id, req.user!.sub);
  if (!attempt) {
    sendError(res, 404, "Attempt not found");
    return;
  }
  // Backend-enforced time limit: reject (and finalize) once expired.
  if (isAttemptExpired(attempt.startedAt, exam.durationMin)) {
    await finalizeAttempt(attempt, {
      submittedAt: attemptDeadline(attempt.startedAt, exam.durationMin),
    });
    sendError(res, 409, "Attempt time limit reached");
    return;
  }

  const questionId = param(req, "questionId");
  const question = await prisma.question.findFirst({
    where: { id: questionId, examId: exam.id },
    select: { id: true, type: true, options: true },
  });
  if (!question) {
    sendError(res, 404, "Question not found");
    return;
  }
  if (!isValidAnswerValue(question, data.value)) {
    sendError(res, 400, "Invalid answer for this question");
    return;
  }

  // Persist the answer atomically, re-asserting the parent attempt is still
  // open inside the transaction. A concurrent submit/finalize stamps
  // `submittedAt`; guarding the write here closes the check-then-write gap so
  // an answer can never land on (or after) an already-submitted attempt. If
  // the attempt was submitted in the meantime, we skip the write and 409.
  const answer = await prisma.$transaction(async (tx) => {
    // Lock the attempt row (matching the lock finalizeAttempt takes) so a
    // concurrent submit/finalize serializes with this write instead of
    // interleaving. Re-read `submittedAt` under the lock: if the attempt has
    // been submitted, skip the upsert and signal a conflict.
    const locked = await tx.$queryRaw<{ submittedAt: Date | null }[]>`
        SELECT "submittedAt" FROM "Attempt" WHERE id = ${attempt.id} FOR UPDATE
      `;
    if (locked.length === 0 || locked[0].submittedAt !== null) return null;

    return tx.answer.upsert({
      where: {
        attemptId_questionId: { attemptId: attempt.id, questionId },
      },
      // Clear any stale grading; correctness is computed at finalize time.
      create: { attemptId: attempt.id, questionId, value: data.value },
      update: { value: data.value, isCorrect: null },
    });
  });

  if (!answer) {
    sendError(res, 409, "Attempt already submitted");
    return;
  }

  res.json({ answer: { questionId: answer.questionId, value: answer.value } });
});

// Submit the active attempt (grades it) and return it.
attemptsRouter.post("/submit", async (req: Request, res: Response) => {
  const exam = await loadExamContext(req, res);
  if (!exam) return;

  const attempt = await findActiveAttempt(exam.id, req.user!.sub);
  if (!attempt) {
    // No active attempt: re-submitting is idempotent, returning the most recent
    // finalized attempt if one exists.
    const last = await prisma.attempt.findFirst({
      where: { examId: exam.id, userId: req.user!.sub },
      orderBy: { startedAt: "desc" },
    });
    if (last?.submittedAt) {
      const answers = await listAnswers(last.id);
      res.json({ attempt: presentAttempt(last, exam.durationMin, answers) });
      return;
    }
    sendError(res, 404, "Attempt not found");
    return;
  }

  // If the limit already passed, stamp the submission at the deadline.
  const expired = isAttemptExpired(attempt.startedAt, exam.durationMin);
  const submittedAt = expired ? attemptDeadline(attempt.startedAt, exam.durationMin) : new Date();

  const finalized = await finalizeAttempt(attempt, { submittedAt });
  const answers = await listAnswers(finalized.id);
  res.json({ attempt: presentAttempt(finalized, exam.durationMin, answers) });
});

// ---------- Attempt history + per-attempt results (/exams/:examId/attempts) ----------

// List the student's attempts for this exam (newest first), with a per-attempt
// score summary. Used by the exam-taking flow and result navigation.
attemptsListRouter.get("/", async (req: Request, res: Response) => {
  const exam = await loadExamContext(req, res);
  if (!exam) return;

  const [attempts, questions] = await Promise.all([
    prisma.attempt.findMany({
      where: { examId: exam.id, userId: req.user!.sub },
      orderBy: { startedAt: "asc" },
      select: { id: true, startedAt: true, submittedAt: true, score: true },
    }),
    prisma.question.findMany({
      where: { examId: exam.id },
      select: { points: true },
    }),
  ]);

  const maxScore = questions.reduce((sum, q) => sum + q.points, 0);

  const summaries = attempts.map((a, index) => ({
    id: a.id,
    examId: exam.id,
    attemptNumber: index + 1,
    startedAt: a.startedAt,
    submittedAt: a.submittedAt,
    score: a.submittedAt ? (a.score ?? 0) : null,
    maxScore,
    percentage:
      a.submittedAt && maxScore > 0 ? Math.round(((a.score ?? 0) / maxScore) * 10000) / 100 : null,
  }));

  res.json({ attempts: summaries });
});

// Retrieve the processed result of one owned, submitted attempt.
attemptsListRouter.get("/:attemptId/result", async (req: Request, res: Response) => {
  const exam = await loadExamContext(req, res);
  if (!exam) return;

  const attemptId = param(req, "attemptId");
  const attempt = await prisma.attempt.findFirst({
    where: { id: attemptId, examId: exam.id, userId: req.user!.sub },
  });
  if (!attempt) {
    sendError(res, 404, "Attempt not found");
    return;
  }

  // Results only exist once submitted; finalize first if the limit has passed.
  let current = attempt;
  if (!attempt.submittedAt && isAttemptExpired(attempt.startedAt, exam.durationMin)) {
    current = await finalizeAttempt(attempt, {
      submittedAt: attemptDeadline(attempt.startedAt, exam.durationMin),
    });
  }
  if (!current.submittedAt) {
    sendError(res, 409, "Attempt not yet submitted");
    return;
  }

  const [questions, answers] = await Promise.all([
    prisma.question.findMany({
      where: { examId: exam.id },
      orderBy: { order: "asc" },
      select: { id: true, points: true },
    }),
    listAnswers(current.id),
  ]);

  res.json({ result: buildAttemptResult(current, questions, answers) });
});
