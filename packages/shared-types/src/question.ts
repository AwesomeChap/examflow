export type QuestionType = "mcq" | "true_false";

type QuestionBase = {
  id: string;
  text: string;
  order: number;
  points: number;
  examId: string;
};

export type McqQuestion = QuestionBase & {
  type: "mcq";
  options: string[];
  correctAnswer: string;
};

export type TrueFalseQuestion = QuestionBase & {
  type: "true_false";
  options: null;
  correctAnswer: "true" | "false";
};

export type Question = McqQuestion | TrueFalseQuestion;
