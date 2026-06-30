export type Answer = {
  id: string;
  value: string;
  isCorrect: boolean | null;
  attemptId: string;
  questionId: string;
};
