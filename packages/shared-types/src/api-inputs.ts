import type { ExamStatus } from "./exam.js";
import type { UserRole } from "./user.js";

/** POST /auth/login — backend also accepts legacy `email` as an alias for `identifier`. */
export type LoginInput = {
  identifier?: string;
  email?: string;
  password: string;
};

export type ExamCreateInput = {
  title: string;
  description?: string | null;
  durationMin?: number;
  status?: ExamStatus;
  startsAt?: string | null;
  maxAttempts?: number | null;
};

export type ExamUpdateInput = Partial<ExamCreateInput>;

export type UserCreateInput = {
  name: string;
  role: Extract<UserRole, "teacher" | "student">;
  password: string;
};

export type AssignStudentsInput = {
  studentIds: string[];
};

export type AnswerUpsertInput = {
  value: string;
};
