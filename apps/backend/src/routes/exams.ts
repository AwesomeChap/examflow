import { Router } from "express";
import type { Request, Response } from "express";
import { canReadExam, examListFilter } from "../lib/examAccess.js";
import { handleKnownPrismaError, sendError } from "../lib/http.js";
import { param } from "../lib/params.js";
import { publicUserSelect, stripAnswerForStudent } from "../lib/present.js";
import { prisma } from "../lib/prisma.js";
import { parseOr400 } from "../lib/validation.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { loadExam, requireExamWrite } from "../middleware/exam.js";
import {
  examCreateSchema,
  examUpdateSchema,
  paginationSchema,
} from "../validation/schemas.js";
import { analyticsRouter } from "./analytics.js";
import { assignmentsRouter } from "./assignments.js";
import { attemptsRouter } from "./attempts.js";
import { questionsRouter } from "./questions.js";

export const examsRouter = Router();

// All exam routes require authentication; writes additionally require staff.
examsRouter.use(requireAuth);

// List exams visible to the current user (role-scoped), paginated.
examsRouter.get("/", async (req: Request, res: Response) => {
  const pagination = parseOr400(paginationSchema, req.query, res);
  if (!pagination) return;

  const { page, pageSize } = pagination;
  const where = examListFilter(req.user!);

  const [total, exams] = await prisma.$transaction([
    prisma.exam.count({ where }),
    prisma.exam.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        createdBy: { select: publicUserSelect },
        _count: { select: { questions: true, attempts: true, assignments: true } },
      },
    }),
  ]);

  res.json({ exams, total, page, pageSize });
});

// Get a single exam with its questions (if the user is authorized to see it).
examsRouter.get("/:examId", async (req: Request, res: Response) => {
  const exam = await prisma.exam.findUnique({
    where: { id: param(req, "examId") },
    include: {
      createdBy: { select: publicUserSelect },
      questions: { orderBy: { order: "asc" } },
    },
  });

  // 404 for both missing and unauthorized to avoid leaking existence.
  if (!exam || !(await canReadExam(req.user!, exam))) {
    sendError(res, 404, "Exam not found");
    return;
  }

  // Students must never receive the correct answers.
  const role = req.user!.role;
  res.json({
    exam: {
      ...exam,
      questions: exam.questions.map((q) => stripAnswerForStudent(role, q)),
    },
  });
});

// Create an exam (staff only). The creator becomes the owner.
examsRouter.post("/", requireStaff, async (req: Request, res: Response) => {
  const data = parseOr400(examCreateSchema, req.body, res);
  if (!data) return;

  const exam = await prisma.exam.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      durationMin: data.durationMin,
      status: data.status,
      startsAt: data.startsAt ?? null,
      createdById: req.user!.sub,
    },
  });
  res.status(201).json({ exam });
});

// Update an exam (admin or owning teacher).
examsRouter.put(
  "/:examId",
  requireStaff,
  loadExam,
  requireExamWrite,
  async (req: Request, res: Response) => {
    const data = parseOr400(examUpdateSchema, req.body, res);
    if (!data) return;

    const exam = await prisma.exam.update({
      where: { id: req.exam!.id },
      data,
    });
    res.json({ exam });
  },
);

// Delete an exam (admin or owning teacher). Cascades to questions/attempts.
examsRouter.delete(
  "/:examId",
  requireStaff,
  loadExam,
  requireExamWrite,
  async (req: Request, res: Response) => {
    try {
      await prisma.exam.delete({ where: { id: req.exam!.id } });
      res.status(204).send();
    } catch (error) {
      if (handleKnownPrismaError(error, res)) return;
      throw error;
    }
  },
);

// Nested routes.
examsRouter.use("/:examId/questions", questionsRouter);
examsRouter.use("/:examId/students", assignmentsRouter);
examsRouter.use("/:examId/attempt", attemptsRouter);
examsRouter.use("/:examId/analytics", analyticsRouter);
