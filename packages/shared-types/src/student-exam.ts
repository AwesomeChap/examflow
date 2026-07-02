import type { StudentQuestion } from "./question.js";
import type { Student } from "./user.js";

/** Student-facing GET /exams/:examId (questions omit correct answers). */
export type StudentExamDetail = {
  id: string;
  title: string;
  description: string | null;
  durationMin: number;
  startsAt: string | null;
  questions: StudentQuestion[];
};

/** GET /exams/:examId/students */
export type ExamAssignment = {
  assignedAt: string;
  student: Student;
};
