export type StudentAttemptStatus = "not_started" | "in_progress" | "submitted";

/** Row on the student dashboard / results list. */
export type StudentDashboardExam = {
  id: string;
  title: string;
  description: string | null;
  durationMin: number;
  startsAt: string | null;
  totalQuestions: number;
  isOpen: boolean;
  startsInMs: number | null;
  attemptStatus: StudentAttemptStatus;
  /** Best submitted score across the student's attempts, or null. */
  score: number | null;
  /** Allowed attempts per student; null means unlimited. */
  maxAttempts: number | null;
  attemptsUsed: number;
  /** Attempts left; null means unlimited. */
  attemptsRemaining: number | null;
  /** Id of the best submitted attempt, for linking to its result. */
  bestAttemptId: string | null;
};
