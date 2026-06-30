export type QuestionType = "mcq" | "true_false";

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
