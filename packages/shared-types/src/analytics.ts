import type { QuestionType } from "./question.js";

export type DistributionBand = {
  label: string;
  min: number;
  max: number;
  count: number;
};

export type QuestionAnalytics = {
  questionId: string;
  order: number;
  text: string;
  type: QuestionType;
  points: number;
  answered: number;
  correct: number;
  /** Percentage of submitted attempts that answered this question correctly. */
  correctRate: number;
};

export type ExamAnalytics = {
  exam: {
    id: string;
    title: string;
    totalQuestions: number;
    maxScore: number;
  };
  attempts: {
    total: number;
    submitted: number;
    inProgress: number;
    assignedStudents: number;
    completionRate: number;
  };
  score: {
    averageScore: number;
    averagePercentage: number;
    highestScore: number | null;
    lowestScore: number | null;
    medianScore: number | null;
    stdDev: number;
    distribution: DistributionBand[];
  };
  timing: {
    averageDurationMs: number | null;
    medianDurationMs: number | null;
  };
  questions: QuestionAnalytics[];
};
