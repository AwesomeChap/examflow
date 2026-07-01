import { Router } from "express";
import type { Request, Response } from "express";
import { handleKnownPrismaError, sendError } from "../lib/http.js";
import { param } from "../lib/params.js";
import { prisma } from "../lib/prisma.js";
import { studentPublicSelect } from "../lib/userSelect.js";
import { parseOr400 } from "../lib/validation.js";
import { requireStaff } from "../middleware/auth.js";
import { loadExam, requireExamWrite } from "../middleware/exam.js";
import { assignStudentsSchema } from "../validation/schemas.js";

// mergeParams to read :examId from the parent exams router.
export const assignmentsRouter = Router({ mergeParams: true });

// Managing the authorized-student list is staff-only and owner-scoped:
// must be staff, the exam must exist, and the caller must be able to write it.
assignmentsRouter.use(requireStaff, loadExam, requireExamWrite);

// List authorized students for an exam.
assignmentsRouter.get("/", async (req: Request, res: Response) => {
  const assignments = await prisma.examAssignment.findMany({
    where: { examId: req.exam!.id },
    orderBy: { assignedAt: "asc" },
    select: {
      assignedAt: true,
      student: {
        select: studentPublicSelect,
      },
    },
  });
  res.json({ students: assignments });
});

// Assign one or more students to an exam.
assignmentsRouter.post("/", async (req: Request, res: Response) => {
  const examId = req.exam!.id;
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
    sendError(res, 400, "Some ids are not valid students", { invalidIds });
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
assignmentsRouter.delete("/:studentId", async (req: Request, res: Response) => {
  const examId = req.exam!.id;
  const studentId = param(req, "studentId");

  try {
    await prisma.examAssignment.delete({
      where: { examId_studentId: { examId, studentId } },
    });
    res.status(204).send();
  } catch (error) {
    if (handleKnownPrismaError(error, res)) return;
    throw error;
  }
});
