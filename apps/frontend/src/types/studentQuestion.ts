import type { QuestionType } from "./question";

/** Question as returned to students (no correct answer). */
export type StudentQuestion = {
  id: string;
  examId: string;
  text: string;
  type: QuestionType;
  options: string[] | null;
  order: number;
  points: number;
};
