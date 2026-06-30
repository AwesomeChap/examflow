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
  score: number | null;
};
