export type ExamStatus = "draft" | "published";

export type Exam = {
  id: string;
  title: string;
  description: string | null;
  durationMin: number;
  status: ExamStatus;
  startsAt: string | null;
  createdAt: string;
  createdById: string;
};
