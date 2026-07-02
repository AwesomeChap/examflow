import type {
  Attempt,
  AttemptHistoryItem,
  AttemptResult,
  StudentExamDetail,
} from "@examflow/shared-types";
import { api } from "./api";

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
        { type: "Attempt", id: `${examId}-list` },
        { type: "StudentDashboard", id: "LIST" },
        { type: "StudentDashboard", id: "RESULTS" },
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
        { type: "Attempt", id: `${examId}-list` },
        { type: "StudentDashboard", id: "LIST" },
        { type: "StudentDashboard", id: "RESULTS" },
      ],
    }),

    getExamAttempts: builder.query<AttemptHistoryItem[], string>({
      query: (examId) => ({ url: `/exams/${examId}/attempts` }),
      transformResponse: (response: { attempts: AttemptHistoryItem[] }) => response.attempts,
      providesTags: (_result, _error, examId) => [{ type: "Attempt", id: `${examId}-list` }],
    }),

    getAttemptResult: builder.query<AttemptResult, { examId: string; attemptId: string }>({
      query: ({ examId, attemptId }) => ({
        url: `/exams/${examId}/attempts/${attemptId}/result`,
      }),
      transformResponse: (response: { result: AttemptResult }) => response.result,
      providesTags: (_result, _error, { attemptId }) => [
        { type: "Attempt", id: `result-${attemptId}` },
      ],
    }),
  }),
});

export const {
  useGetStudentExamQuery,
  useStartAttemptMutation,
  useGetAttemptQuery,
  useSaveAnswerMutation,
  useSubmitAttemptMutation,
  useGetExamAttemptsQuery,
  useGetAttemptResultQuery,
} = attemptsApi;
