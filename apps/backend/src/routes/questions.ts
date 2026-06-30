import { Router } from "express";
import type { Request, Response } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { canReadExam } from "../lib/examAccess.js";
import { handleKnownPrismaError, sendError } from "../lib/http.js";
import { param } from "../lib/params.js";
import { stripAnswerForStudent } from "../lib/present.js";
import { prisma } from "../lib/prisma.js";
import { parseOr400 } from "../lib/validation.js";
import { requireStaff } from "../middleware/auth.js";
import { loadExam, requireExamWrite } from "../middleware/exam.js";
import {
  questionCreateSchema,
  questionPatchSchema,
} from "../validation/schemas.js";

// mergeParams lets us read :examId from the parent router.
export const questionsRouter = Router({ mergeParams: true });

// Load the parent exam (into req.exam) for every question route; 404 if absent.
questionsRouter.use(loadExam);

async function nextOrder(examId: string): Promise<number> {
  const agg = await prisma.question.aggregate({
    where: { examId },
    _max: { order: true },
  });
  return (agg._max.order ?? 0) + 1;
}

// Read guard: anyone allowed to read the exam may read its questions.
async function ensureReadAccess(
  req: Request,
  res: Response,
): Promise<boolean> {
  if (!(await canReadExam(req.user!, req.exam!))) {
    sendError(res, 404, "Exam not found");
    return false;
  }
  return true;
}

// List questions for an exam.
questionsRouter.get("/", async (req: Request, res: Response) => {
  if (!(await ensureReadAccess(req, res))) return;

  const questions = await prisma.question.findMany({
    where: { examId: req.exam!.id },
    orderBy: { order: "asc" },
  });
  const role = req.user!.role;
  res.json({ questions: questions.map((q) => stripAnswerForStudent(role, q)) });
});

// Get a single question.
questionsRouter.get("/:questionId", async (req: Request, res: Response) => {
  if (!(await ensureReadAccess(req, res))) return;

  const question = await prisma.question.findFirst({
    where: { id: param(req, "questionId"), examId: req.exam!.id },
  });
  if (!question) {
    sendError(res, 404, "Question not found");
    return;
  }
  res.json({ question: stripAnswerForStudent(req.user!.role, question) });
});

// Create a question (admin or owning teacher).
questionsRouter.post(
  "/",
  requireStaff,
  requireExamWrite,
  async (req: Request, res: Response) => {
    const data = parseOr400(questionCreateSchema, req.body, res);
    if (!data) return;

    const examId = req.exam!.id;
    const order = data.order ?? (await nextOrder(examId));

    try {
      const question = await prisma.question.create({
        data: {
          examId,
          type: data.type,
          text: data.text,
          correctAnswer: data.correctAnswer,
          order,
          points: data.points,
          // For true_false, `options` is omitted -> stored as SQL NULL.
          ...(data.type === "mcq" ? { options: data.options } : {}),
        },
      });
      res.status(201).json({ question });
    } catch (error) {
      if (handleKnownPrismaError(error, res)) return;
      throw error;
    }
  },
);

// Update a question (admin or owning teacher). Body may be partial; the merged
// result is re-validated so MCQ/True-False shape rules always hold.
questionsRouter.put(
  "/:questionId",
  requireStaff,
  requireExamWrite,
  async (req: Request, res: Response) => {
    const questionId = param(req, "questionId");
    const patch = parseOr400(questionPatchSchema, req.body, res);
    if (!patch) return;

    const existing = await prisma.question.findFirst({
      where: { id: questionId, examId: req.exam!.id },
    });
    if (!existing) {
      sendError(res, 404, "Question not found");
      return;
    }

    const finalType = patch.type ?? existing.type;
    const candidate = {
      type: finalType,
      text: patch.text ?? existing.text,
      order: patch.order ?? existing.order,
      points: patch.points ?? existing.points,
      correctAnswer: patch.correctAnswer ?? existing.correctAnswer,
      options:
        finalType === "mcq"
          ? patch.options !== undefined
            ? patch.options
            : existing.options
          : null,
    };

    const validated = parseOr400(questionCreateSchema, candidate, res);
    if (!validated) return;

    try {
      const question = await prisma.question.update({
        where: { id: questionId },
        data: {
          type: validated.type,
          text: validated.text,
          order: validated.order,
          points: validated.points,
          correctAnswer: validated.correctAnswer,
          options:
            validated.type === "mcq" ? validated.options : Prisma.DbNull,
        },
      });
      res.json({ question });
    } catch (error) {
      if (handleKnownPrismaError(error, res)) return;
      throw error;
    }
  },
);

// Delete a question (admin or owning teacher).
questionsRouter.delete(
  "/:questionId",
  requireStaff,
  requireExamWrite,
  async (req: Request, res: Response) => {
    const questionId = param(req, "questionId");
    const existing = await prisma.question.findFirst({
      where: { id: questionId, examId: req.exam!.id },
      select: { id: true },
    });
    if (!existing) {
      sendError(res, 404, "Question not found");
      return;
    }

    await prisma.question.delete({ where: { id: questionId } });
    res.status(204).send();
  },
);
