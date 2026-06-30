import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "./useToast";
import { toQuestionBody } from "../lib/questionBody";
import { useAssignStudentsMutation, useLazyGetExamStudentsQuery } from "../store/assignmentsApi";
import { useCreateExamMutation, useLazyGetExamQuery } from "../store/examsApi";
import { useCreateQuestionMutation, useLazyGetExamQuestionsQuery } from "../store/questionsApi";

/**
 * Clones an exam into a fresh draft: copies metadata, questions (in order) and
 * the assigned-student list, then navigates to the new exam's editor. Used to
 * fast-track creating a new exam from a locked (already-started) one.
 */
export function useCloneExam() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [fetchExam] = useLazyGetExamQuery();
  const [fetchQuestions] = useLazyGetExamQuestionsQuery();
  const [fetchStudents] = useLazyGetExamStudentsQuery();
  const [createExam] = useCreateExamMutation();
  const [createQuestion] = useCreateQuestionMutation();
  const [assignStudents] = useAssignStudentsMutation();

  const [cloningId, setCloningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clone = useCallback(
    async (examId: string) => {
      setCloningId(examId);
      setError(null);
      try {
        const [exam, questions, studentIds] = await Promise.all([
          fetchExam(examId).unwrap(),
          fetchQuestions(examId).unwrap(),
          fetchStudents(examId).unwrap(),
        ]);

        const created = await createExam({
          title: `Copy of ${exam.title}`,
          description: exam.description,
          durationMin: exam.durationMin,
          status: "draft",
        }).unwrap();

        const ordered = [...questions].sort((a, b) => a.order - b.order);
        for (const question of ordered) {
          await createQuestion({ examId: created.id, body: toQuestionBody(question) }).unwrap();
        }
        if (studentIds.length > 0) {
          await assignStudents({ examId: created.id, studentIds }).unwrap();
        }

        notify({ message: "Exam cloned to a new draft.", variant: "success" });
        navigate(`/exam/${created.id}/edit`);
      } catch {
        setError("Could not clone the exam. Please try again.");
        notify({ message: "Could not clone the exam.", variant: "error" });
      } finally {
        setCloningId(null);
      }
    },
    [fetchExam, fetchQuestions, fetchStudents, createExam, createQuestion, assignStudents, navigate, notify],
  );

  return { clone, cloningId, error };
}
