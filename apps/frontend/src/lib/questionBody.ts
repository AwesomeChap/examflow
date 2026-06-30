import type { QuestionBody } from "../store/questionsApi";
import type { Question } from "../types/question";

/** Maps a stored question into the request body accepted by the API. */
export function toQuestionBody(question: Question): QuestionBody {
  if (question.type === "mcq") {
    return {
      type: "mcq",
      text: question.text,
      options: question.options ?? [],
      correctAnswer: question.correctAnswer,
      points: question.points,
    };
  }
  return {
    type: "true_false",
    text: question.text,
    correctAnswer: question.correctAnswer === "false" ? "false" : "true",
    points: question.points,
  };
}
