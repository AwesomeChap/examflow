import type { Exam, ExamDetail, ExamListItem, ExamStatus, Paginated } from "@examflow/shared-types";
import { api } from "./api";

export type ExamListParams = {
  page: number;
  pageSize: number;
};

type ExamListResponse = {
  exams: ExamListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type CreateExamBody = {
  title: string;
  description?: string | null;
  durationMin?: number;
  status?: ExamStatus;
  /** ISO string, or null for "available immediately". */
  startsAt?: string | null;
  /** Allowed attempts per student; null means unlimited. */
  maxAttempts?: number | null;
};

export type UpdateExamBody = Partial<CreateExamBody>;

export const examsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getExams: builder.query<Paginated<ExamListItem>, ExamListParams>({
      query: ({ page, pageSize }) => ({
        url: "/exams",
        params: { page, pageSize },
      }),
      transformResponse: (response: ExamListResponse) => ({
        items: response.exams,
        total: response.total,
        page: response.page,
        pageSize: response.pageSize,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((exam) => ({ type: "Exam" as const, id: exam.id })),
              { type: "Exam" as const, id: "LIST" },
            ]
          : [{ type: "Exam" as const, id: "LIST" }],
    }),

    getExam: builder.query<ExamDetail, string>({
      query: (examId) => ({ url: `/exams/${examId}` }),
      transformResponse: (response: { exam: ExamDetail }) => response.exam,
      providesTags: (_result, _error, examId) => [{ type: "Exam", id: examId }],
    }),

    createExam: builder.mutation<Exam, CreateExamBody>({
      query: (body) => ({ url: "/exams", method: "POST", body }),
      transformResponse: (response: { exam: Exam }) => response.exam,
      invalidatesTags: [{ type: "Exam", id: "LIST" }, "AdminDashboard"],
    }),

    updateExam: builder.mutation<Exam, { id: string; body: UpdateExamBody }>({
      query: ({ id, body }) => ({ url: `/exams/${id}`, method: "PUT", body }),
      transformResponse: (response: { exam: Exam }) => response.exam,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Exam", id },
        { type: "Exam", id: "LIST" },
      ],
    }),

    deleteExam: builder.mutation<void, string>({
      query: (id) => ({ url: `/exams/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Exam", id: "LIST" }, "AdminDashboard"],
    }),
  }),
});

export const {
  useGetExamsQuery,
  useGetExamQuery,
  useLazyGetExamQuery,
  useCreateExamMutation,
  useUpdateExamMutation,
  useDeleteExamMutation,
} = examsApi;
