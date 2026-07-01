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
