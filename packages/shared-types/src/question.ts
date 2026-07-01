export type QuestionType = "mcq" | "true_false";

/** Full question (staff-facing; includes the correct answer). */
export type Question = {
  id: string;
  examId: string;
  text: string;
  type: QuestionType;
  /** Non-null only for MCQ questions. */
  options: string[] | null;
  correctAnswer: string;
  order: number;
  points: number;
};

/** Payload shared by question create/update forms. */
export type QuestionDraft = {
  type: QuestionType;
  text: string;
  /** Present for MCQ; ignored/null for true_false. */
  options: string[];
  correctAnswer: string;
  points: number;
};

/** Question as returned to students (never includes the correct answer). */
export type StudentQuestion = {
  id: string;
  examId: string;
  text: string;
  type: QuestionType;
  options: string[] | null;
  order: number;
  points: number;
};
