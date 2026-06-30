export type Exam = {
  id: string;
  title: string;
  description: string | null;
  durationMin: number;
  startsAt: string | null;
  createdAt: string;
  createdById: string;
};
