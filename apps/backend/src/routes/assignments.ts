import { Router } from "express";
import type { Request, Response } from "express";
import { canWriteExam } from "../lib/examAccess.js";
import { handleKnownPrismaError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { parseOr400 } from "../lib/validation.js";
import { requireStaff } from "../middleware/auth.js";
import { assignStudentsSchema } from "../validation/schemas.js";

// mergeParams to read :examId from the parent exams router.
export const assignmentsRouter = Router({ mergeParams: true });

// Managing the authorized-student list is staff-only and owner-scoped.
assignmentsRouter.use(requireStaff);

// Loads the exam and enforces write access (admin or the creating teacher).
assignmentsRouter.use(async (req: Request, res: Response, next) => {
  const { examId } = req.params as { examId: string };
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true, createdById: true },
  });

  if (!exam || !canWriteExam(req.user!, exam)) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }
  next();
});

// List authorized students for an exam.
assignmentsRouter.get("/", async (req: Request, res: Response) => {
  const { examId } = req.params as { examId: string };
  const assignments = await prisma.examAssignment.findMany({
    where: { examId },
    orderBy: { assignedAt: "asc" },
    select: {
      assignedAt: true,
      student: {
        select: { id: true, name: true, email: true, matriculationNumber: true },
      },
    },
  });
  res.json({ students: assignments });
});

// Assign one or more students to an exam.
assignmentsRouter.post("/", async (req: Request, res: Response) => {
  const { examId } = req.params as { examId: string };
  const data = parseOr400(assignStudentsSchema, req.body, res);
  if (!data) return;

  const uniqueIds = [...new Set(data.studentIds)];

  // All provided ids must reference existing student accounts.
  const students = await prisma.user.findMany({
    where: { id: { in: uniqueIds }, role: "student" },
    select: { id: true },
  });
  const validIds = new Set(students.map((s) => s.id));
  const invalidIds = uniqueIds.filter((id) => !validIds.has(id));

  if (invalidIds.length > 0) {
    res.status(400).json({
      error: "Some ids are not valid students",
      invalidIds,
    });
    return;
  }

  try {
    await prisma.examAssignment.createMany({
      data: uniqueIds.map((studentId) => ({ examId, studentId })),
      skipDuplicates: true,
    });
    res.status(201).json({ assigned: uniqueIds.length });
  } catch (error) {
    if (handleKnownPrismaError(error, res)) return;
    throw error;
  }
});

// Unassign a student from an exam.
assignmentsRouter.delete(
  "/:studentId",
  async (req: Request, res: Response) => {
    const { examId, studentId } = req.params as {
      examId: string;
      studentId: string;
    };

    try {
      await prisma.examAssignment.delete({
        where: { examId_studentId: { examId, studentId } },
      });
      res.status(204).send();
    } catch (error) {
      if (handleKnownPrismaError(error, res)) return;
      throw error;
    }
  },
);
