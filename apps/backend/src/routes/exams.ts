import { Router } from "express";
import type { Request, Response } from "express";
import { canReadExam, canWriteExam, examListFilter } from "../lib/examAccess.js";
import { handleKnownPrismaError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { parseOr400 } from "../lib/validation.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { examCreateSchema, examUpdateSchema } from "../validation/schemas.js";
import { assignmentsRouter } from "./assignments.js";
import { questionsRouter } from "./questions.js";

export const examsRouter = Router();

// All exam routes require authentication; writes additionally require staff.
examsRouter.use(requireAuth);

// List exams visible to the current user (role-scoped).
examsRouter.get("/", async (req: Request, res: Response) => {
  const exams = await prisma.exam.findMany({
    where: examListFilter(req.user!),
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { questions: true, attempts: true, assignments: true } },
    },
  });
  res.json({ exams });
});

// Get a single exam with its questions (if the user is authorized to see it).
examsRouter.get("/:examId", async (req: Request, res: Response) => {
  const { examId } = req.params as { examId: string };
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      questions: { orderBy: { order: "asc" } },
    },
  });

  // 404 for both missing and unauthorized to avoid leaking existence.
  if (!exam || !(await canReadExam(req.user!, exam))) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  // Students must never receive the correct answers.
  if (req.user!.role === "student") {
    const { questions, ...rest } = exam;
    res.json({
      exam: {
        ...rest,
        questions: questions.map(({ correctAnswer: _omit, ...q }) => q),
      },
    });
    return;
  }

  res.json({ exam });
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
      createdById: req.user!.sub,
    },
  });
  res.status(201).json({ exam });
});

// Update an exam (admin or owning teacher).
examsRouter.put("/:examId", requireStaff, async (req: Request, res: Response) => {
  const { examId } = req.params as { examId: string };

  const existing = await prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true, createdById: true },
  });
  if (!existing || !canWriteExam(req.user!, existing)) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  const data = parseOr400(examUpdateSchema, req.body, res);
  if (!data) return;

  const exam = await prisma.exam.update({ where: { id: examId }, data });
  res.json({ exam });
});

// Delete an exam (admin or owning teacher). Cascades to questions/attempts.
examsRouter.delete(
  "/:examId",
  requireStaff,
  async (req: Request, res: Response) => {
    const { examId } = req.params as { examId: string };

    const existing = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, createdById: true },
    });
    if (!existing || !canWriteExam(req.user!, existing)) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }

    try {
      await prisma.exam.delete({ where: { id: examId } });
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
