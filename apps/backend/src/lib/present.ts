import type { UserRole } from "@examflow/shared-types";

// Reusable "safe" projection of a user for embedding in responses.
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
} as const;

/**
 * Removes `correctAnswer` from a question for students; returns it unchanged
 * for staff. Centralized so this security-sensitive transform lives in exactly
 * one place (used by both the exam and question routes).
 */
export function stripAnswerForStudent<T extends { correctAnswer: unknown }>(
  role: UserRole,
  question: T,
): T | Omit<T, "correctAnswer"> {
  if (role !== "student") return question;
  const { correctAnswer: _omit, ...rest } = question;
  return rest;
}
