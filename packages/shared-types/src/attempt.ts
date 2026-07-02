export type AttemptAnswer = {
  questionId: string;
  value: string;
  isCorrect?: boolean;
};

/** An attempt as presented to the student taking it. */
export type Attempt = {
  id: string;
  examId: string;
  startedAt: string;
  deadline: string;
  submittedAt: string | null;
  score: number | null;
  remainingMs: number;
  answers: AttemptAnswer[];
};

export type ResultBreakdownItem = {
  questionId: string;
  points: number;
  awardedPoints: number;
  answered: boolean;
  value: string | null;
  isCorrect: boolean | null;
};

export type AttemptResult = {
  attemptId: string;
  examId: string;
  submittedAt: string | null;
  score: number;
  maxScore: number;
  percentage: number;
  totalQuestions: number;
  correctCount: number;
  breakdown: ResultBreakdownItem[];
};

/** A submitted attempt row on the Results tab (GET /student/results). */
export type StudentResult = {
  id: string;
  examId: string;
  title: string;
  attemptNumber: number;
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt: string | null;
};

/** Per-exam attempt list item (GET /exams/:examId/attempts). */
export type AttemptHistoryItem = {
  id: string;
  examId: string;
  attemptNumber: number;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number;
  percentage: number | null;
};

/** @deprecated Use `StudentResult` for the results tab or `AttemptHistoryItem` for per-exam history. */
export type AttemptSummary = StudentResult;
