import type { ExamDetail, ExamListItem, Paginated } from "../types/exam";
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
  }),
});

export const { useGetExamsQuery, useGetExamQuery } = examsApi;
