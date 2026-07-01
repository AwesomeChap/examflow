export type AttemptAnswer = {
  questionId: string;
  value: string;
  isCorrect?: boolean;
};

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
