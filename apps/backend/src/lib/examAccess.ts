import type { ExamStatus } from "../generated/prisma/client.js";
import type { AuthTokenPayload } from "./auth.js";
import { prisma } from "./prisma.js";

/**
 * Read access:
 *  - admin: any exam
 *  - teacher: only exams they created
 *  - student: only published exams they are assigned to
 */
export async function canReadExam(
  user: AuthTokenPayload,
  exam: { id: string; createdById: string; status: ExamStatus },
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role === "teacher") return exam.createdById === user.sub;

  if (exam.status !== "published") return false;

  const assignment = await prisma.examAssignment.findUnique({
    where: { examId_studentId: { examId: exam.id, studentId: user.sub } },
    select: { examId: true },
  });
  return assignment !== null;
}

/**
 * Write access (create/update/delete exam, questions, assignments):
 *  - admin: any exam
 *  - teacher: only exams they created
 *  - student: never
 */
export function canWriteExam(user: AuthTokenPayload, exam: { createdById: string }): boolean {
  return user.role === "admin" || exam.createdById === user.sub;
}

/** Prisma `where` filter for listing exams visible to the user. */
export function examListFilter(user: AuthTokenPayload) {
  if (user.role === "admin") return {};
  if (user.role === "teacher") return { createdById: user.sub };
  return { assignments: { some: { studentId: user.sub } }, status: "published" as const };
}
