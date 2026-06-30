import type { ExamCounts, ExamStatus } from "../types/exam";

type EditableExam = {
  status: ExamStatus;
  startsAt: string | null;
  _count?: ExamCounts;
};

/**
 * An exam can be edited only while it is still safe to change:
 *  - no student has attempted it yet, and
 *  - it has not started (a published exam with no explicit start time is treated
 *    as already live / immediately available).
 *
 * Locked exams can still be cloned to fast-track a fresh one.
 */
export function isExamEditable(exam: EditableExam, now: Date = new Date()): boolean {
  if ((exam._count?.attempts ?? 0) > 0) return false;
  if (exam.startsAt) return new Date(exam.startsAt).getTime() > now.getTime();
  return exam.status === "draft";
}

/** Human-readable reason an exam is locked (for the editor banner). */
export function lockReason(exam: EditableExam, now: Date = new Date()): string | null {
  if (isExamEditable(exam, now)) return null;
  if ((exam._count?.attempts ?? 0) > 0) {
    return "This exam already has results, so it can no longer be edited. You can clone it instead.";
  }
  return "This exam has already started, so it can no longer be edited. You can clone it instead.";
}
