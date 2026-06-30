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

// Nested under /exams/:examId/attempt. Inherits requireAuth from the parent
// exams router; here we additionally restrict the whole flow to students.
export const attemptsRouter = Router({ mergeParams: true });

attemptsRouter.use(requireStudent);

type ExamContext = {
  id: string;
  createdById: string;
  durationMin: number;
};

// Loads the exam (with its time limit) and confirms the student is allowed to
// read it (i.e. is assigned). Returns null after sending a 404 on failure so
// existence is never leaked.
async function loadExamContext(
  req: Request,
  res: Response,
): Promise<ExamContext | null> {
  const exam = await prisma.exam.findUnique({
    where: { id: param(req, "examId") },
    select: { id: true, createdById: true, durationMin: true },
  });

  if (!exam || !(await canReadExam(req.user!, exam))) {
    sendError(res, 404, "Exam not found");
    return null;
  }
  return exam;
}

function findAttempt(examId: string, userId: string) {
  return prisma.attempt.findUnique({
    where: { userId_examId: { userId, examId } },
  });
}

function listAnswers(attemptId: string) {
  return prisma.answer.findMany({ where: { attemptId } });
}

// Start (or resume) the current user's attempt for an exam.
attemptsRouter.post("/", async (req: Request, res: Response) => {
  const exam = await loadExamContext(req, res);
  if (!exam) return;

  const userId = req.user!.sub;
  const existing = await findAttempt(exam.id, userId);

  if (existing) {
    if (existing.submittedAt) {
      sendError(res, 409, "Attempt already submitted");
      return;
    }
    if (isAttemptExpired(existing.startedAt, exam.durationMin)) {
      await finalizeAttempt(existing, {
        submittedAt: attemptDeadline(existing.startedAt, exam.durationMin),
      });
      sendError(res, 409, "Attempt time limit reached");
      return;
    }
    // Resuming an in-progress attempt is idempotent.
    const answers = await listAnswers(existing.id);
    res.json({ attempt: presentAttempt(existing, exam.durationMin, answers) });
    return;
  }

  try {
    const attempt = await prisma.attempt.create({
      data: { examId: exam.id, userId },
    });
    res
      .status(201)
      .json({ attempt: presentAttempt(attempt, exam.durationMin, []) });
  } catch (error) {
    // Handles the rare race where two starts hit the unique (userId, examId).
    if (handleKnownPrismaError(error, res)) return;
    throw error;
  }
});

// Read the current attempt state (auto-finalizes if the time limit passed).
attemptsRouter.get("/", async (req: Request, res: Response) => {
  const exam = await loadExamContext(req, res);
  if (!exam) return;

  const attempt = await findAttempt(exam.id, req.user!.sub);
  if (!attempt) {
    sendError(res, 404, "Attempt not found");
    return;
  }

  let current = attempt;
  if (
    !attempt.submittedAt &&
    isAttemptExpired(attempt.startedAt, exam.durationMin)
  ) {
    current = await finalizeAttempt(attempt, {
      submittedAt: attemptDeadline(attempt.startedAt, exam.durationMin),
    });
  }

  const answers = await listAnswers(current.id);
  res.json({ attempt: presentAttempt(current, exam.durationMin, answers) });
});

// Retrieve the processed result of a submitted attempt (score breakdown).
attemptsRouter.get("/result", async (req: Request, res: Response) => {
  const exam = await loadExamContext(req, res);
  if (!exam) return;

  const attempt = await findAttempt(exam.id, req.user!.sub);
  if (!attempt) {
    sendError(res, 404, "Attempt not found");
    return;
  }

  // Results only exist once submitted; finalize first if the limit has passed.
  let current = attempt;
  if (
    !attempt.submittedAt &&
    isAttemptExpired(attempt.startedAt, exam.durationMin)
  ) {
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

// Store / update the answer to one question during an attempt.
attemptsRouter.put(
  "/answers/:questionId",
  async (req: Request, res: Response) => {
    const exam = await loadExamContext(req, res);
    if (!exam) return;

    const data = parseOr400(answerUpsertSchema, req.body, res);
    if (!data) return;

    const attempt = await findAttempt(exam.id, req.user!.sub);
    if (!attempt) {
      sendError(res, 404, "Attempt not found");
      return;
    }
    if (attempt.submittedAt) {
      sendError(res, 409, "Attempt already submitted");
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

    const answer = await prisma.answer.upsert({
      where: {
        attemptId_questionId: { attemptId: attempt.id, questionId },
      },
      // Clear any stale grading; correctness is computed at finalize time.
      create: { attemptId: attempt.id, questionId, value: data.value },
      update: { value: data.value, isCorrect: null },
    });

    res.json({ answer: { questionId: answer.questionId, value: answer.value } });
  },
);

// Submit the attempt (grades it). Idempotent once submitted.
attemptsRouter.post("/submit", async (req: Request, res: Response) => {
  const exam = await loadExamContext(req, res);
  if (!exam) return;

  const attempt = await findAttempt(exam.id, req.user!.sub);
  if (!attempt) {
    sendError(res, 404, "Attempt not found");
    return;
  }

  if (attempt.submittedAt) {
    const answers = await listAnswers(attempt.id);
    res.json({ attempt: presentAttempt(attempt, exam.durationMin, answers) });
    return;
  }

  // If the limit already passed, stamp the submission at the deadline.
  const expired = isAttemptExpired(attempt.startedAt, exam.durationMin);
  const submittedAt = expired
    ? attemptDeadline(attempt.startedAt, exam.durationMin)
    : new Date();

  const finalized = await finalizeAttempt(attempt, { submittedAt });
  const answers = await listAnswers(finalized.id);
  res.json({ attempt: presentAttempt(finalized, exam.durationMin, answers) });
});
