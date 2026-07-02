import type { Question, QuestionCreateInput } from "@examflow/shared-types";
import { api } from "./api";

export type { QuestionCreateInput as QuestionBody };

export const questionsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getExamQuestions: builder.query<Question[], string>({
      query: (examId) => ({ url: `/exams/${examId}/questions` }),
      transformResponse: (response: { questions: Question[] }) => response.questions,
      providesTags: (_result, _error, examId) => [{ type: "Question", id: examId }],
    }),

    createQuestion: builder.mutation<Question, { examId: string; body: QuestionCreateInput }>({
      query: ({ examId, body }) => ({
        url: `/exams/${examId}/questions`,
        method: "POST",
        body,
      }),
      transformResponse: (response: { question: Question }) => response.question,
      invalidatesTags: (_result, _error, { examId }) => [
        { type: "Question", id: examId },
        { type: "Exam", id: examId },
        { type: "Exam", id: "LIST" },
      ],
    }),

    updateQuestion: builder.mutation<
      Question,
      { examId: string; questionId: string; body: QuestionCreateInput }
    >({
      query: ({ examId, questionId, body }) => ({
        url: `/exams/${examId}/questions/${questionId}`,
        method: "PUT",
        body,
      }),
      transformResponse: (response: { question: Question }) => response.question,
      invalidatesTags: (_result, _error, { examId }) => [
        { type: "Question", id: examId },
        { type: "Exam", id: examId },
      ],
    }),

    deleteQuestion: builder.mutation<void, { examId: string; questionId: string }>({
      query: ({ examId, questionId }) => ({
        url: `/exams/${examId}/questions/${questionId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { examId }) => [
        { type: "Question", id: examId },
        { type: "Exam", id: examId },
        { type: "Exam", id: "LIST" },
      ],
    }),

    reorderQuestions: builder.mutation<Question[], { examId: string; orderedIds: string[] }>({
      query: ({ examId, orderedIds }) => ({
        url: `/exams/${examId}/questions/reorder`,
        method: "POST",
        body: { orderedIds },
      }),
      transformResponse: (response: { questions: Question[] }) => response.questions,
      invalidatesTags: (_result, _error, { examId }) => [{ type: "Question", id: examId }],
    }),
  }),
});

export const {
  useGetExamQuestionsQuery,
  useLazyGetExamQuestionsQuery,
  useCreateQuestionMutation,
  useUpdateQuestionMutation,
  useDeleteQuestionMutation,
  useReorderQuestionsMutation,
} = questionsApi;
