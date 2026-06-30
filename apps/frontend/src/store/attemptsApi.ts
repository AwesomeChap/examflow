import type { Attempt, AttemptResult } from "../types/attempt";
import type { StudentQuestion } from "../types/studentQuestion";
import { api } from "./api";

export type StudentExamDetail = {
  id: string;
  title: string;
  description: string | null;
  durationMin: number;
  startsAt: string | null;
  questions: StudentQuestion[];
};

export const attemptsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getStudentExam: builder.query<StudentExamDetail, string>({
      query: (examId) => ({ url: `/exams/${examId}` }),
      transformResponse: (response: { exam: StudentExamDetail }) => response.exam,
      providesTags: (_result, _error, examId) => [{ type: "Exam", id: examId }],
    }),

    startAttempt: builder.mutation<Attempt, string>({
      query: (examId) => ({ url: `/exams/${examId}/attempt`, method: "POST" }),
      transformResponse: (response: { attempt: Attempt }) => response.attempt,
      invalidatesTags: (_result, _error, examId) => [
        { type: "Attempt", id: examId },
        { type: "StudentDashboard", id: "LIST" },
      ],
    }),

    getAttempt: builder.query<Attempt, string>({
      query: (examId) => ({ url: `/exams/${examId}/attempt` }),
      transformResponse: (response: { attempt: Attempt }) => response.attempt,
      providesTags: (_result, _error, examId) => [{ type: "Attempt", id: examId }],
    }),

    saveAnswer: builder.mutation<
      { questionId: string; value: string },
      { examId: string; questionId: string; value: string }
    >({
      query: ({ examId, questionId, value }) => ({
        url: `/exams/${examId}/attempt/answers/${questionId}`,
        method: "PUT",
        body: { value },
      }),
      transformResponse: (response: { answer: { questionId: string; value: string } }) =>
        response.answer,
      async onQueryStarted({ examId, questionId, value }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          attemptsApi.util.updateQueryData("getAttempt", examId, (draft) => {
            const existing = draft.answers.find((a) => a.questionId === questionId);
            if (existing) existing.value = value;
            else draft.answers.push({ questionId, value });
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    submitAttempt: builder.mutation<Attempt, string>({
      query: (examId) => ({ url: `/exams/${examId}/attempt/submit`, method: "POST" }),
      transformResponse: (response: { attempt: Attempt }) => response.attempt,
      invalidatesTags: (_result, _error, examId) => [
        { type: "Attempt", id: examId },
        { type: "StudentDashboard", id: "LIST" },
      ],
    }),

    getAttemptResult: builder.query<AttemptResult, string>({
      query: (examId) => ({ url: `/exams/${examId}/attempt/result` }),
      transformResponse: (response: { result: AttemptResult }) => response.result,
      providesTags: (_result, _error, examId) => [{ type: "Attempt", id: `${examId}-result` }],
    }),
  }),
});

export const {
  useGetStudentExamQuery,
  useStartAttemptMutation,
  useGetAttemptQuery,
  useSaveAnswerMutation,
  useSubmitAttemptMutation,
  useGetAttemptResultQuery,
} = attemptsApi;
