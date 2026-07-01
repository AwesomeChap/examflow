import type { Question } from "@examflow/shared-types";
import { api } from "./api";

/** Shape accepted by the question create/update endpoints. */
export type QuestionBody =
  | {
      type: "mcq";
      text: string;
      options: string[];
      correctAnswer: string;
      points?: number;
    }
  | {
      type: "true_false";
      text: string;
      correctAnswer: "true" | "false";
      points?: number;
    };

export const questionsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getExamQuestions: builder.query<Question[], string>({
      query: (examId) => ({ url: `/exams/${examId}/questions` }),
      transformResponse: (response: { questions: Question[] }) => response.questions,
      providesTags: (_result, _error, examId) => [{ type: "Question", id: examId }],
    }),

    createQuestion: builder.mutation<Question, { examId: string; body: QuestionBody }>({
      query: ({ examId, body }) => ({
        url: `/exams/${examId}/questions`,
        method: "POST",
        body,
      }),
      transformResponse: (response: { question: Question }) => response.question,
      // Refresh the question list and the exam's question count in the listing.
      invalidatesTags: (_result, _error, { examId }) => [
        { type: "Question", id: examId },
        { type: "Exam", id: examId },
        { type: "Exam", id: "LIST" },
      ],
    }),

    updateQuestion: builder.mutation<
      Question,
      { examId: string; questionId: string; body: QuestionBody }
    >({
      query: ({ examId, questionId, body }) => ({
        url: `/exams/${examId}/questions/${questionId}`,
        method: "PUT",
        body,
      }),
      transformResponse: (response: { question: Question }) => response.question,
      invalidatesTags: (_result, _error, { examId }) => [{ type: "Question", id: examId }],
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
      // Optimistically apply the new order so the list doesn't flicker.
      async onQueryStarted({ examId, orderedIds }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          questionsApi.util.updateQueryData("getExamQuestions", examId, (draft) => {
            const byId = new Map(draft.map((q) => [q.id, q]));
            const reordered = orderedIds
              .map((id, index) => {
                const q = byId.get(id);
                return q ? { ...q, order: index + 1 } : null;
              })
              .filter((q): q is Question => q !== null);
            return reordered;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
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
