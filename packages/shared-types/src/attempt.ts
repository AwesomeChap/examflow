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

/** A single submitted attempt as shown in the Results tab / attempt history. */
export type AttemptSummary = {
  id: string;
  examId: string;
  title: string;
  attemptNumber: number;
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt: string | null;
};
