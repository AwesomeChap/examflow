export type Attempt = {
  id: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  examId: string;
  userId: string;
};
