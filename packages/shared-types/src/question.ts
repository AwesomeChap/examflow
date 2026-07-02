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

/** Payload shared by question create/update forms (no `order`; set on create via API). */
export type QuestionDraft = {
  type: QuestionType;
  text: string;
  /** Present for MCQ; ignored/null for true_false. */
  options: string[];
  correctAnswer: string;
  points: number;
};

export type QuestionCreateInput =
  | {
      type: "mcq";
      text: string;
      options: string[];
      correctAnswer: string;
      order?: number;
      points?: number;
    }
  | {
      type: "true_false";
      text: string;
      correctAnswer: "true" | "false";
      options?: null;
      order?: number;
      points?: number;
    };

export type QuestionPatchInput = {
  type?: QuestionType;
  text?: string;
  options?: string[] | null;
  correctAnswer?: string;
  order?: number;
  points?: number;
};

export type QuestionReorderInput = {
  orderedIds: string[];
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
