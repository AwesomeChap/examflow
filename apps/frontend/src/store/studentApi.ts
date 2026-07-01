import type { AttemptSummary, StudentDashboardExam } from "@examflow/shared-types";
import { api } from "./api";

export const studentApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getStudentDashboard: builder.query<StudentDashboardExam[], void>({
      query: () => ({ url: "/student/dashboard" }),
      transformResponse: (response: { exams: StudentDashboardExam[] }) => response.exams,
      providesTags: [{ type: "StudentDashboard", id: "LIST" }],
    }),

    getStudentResults: builder.query<AttemptSummary[], void>({
      query: () => ({ url: "/student/results" }),
      transformResponse: (response: { results: AttemptSummary[] }) => response.results,
      providesTags: [{ type: "StudentDashboard", id: "RESULTS" }],
    }),
  }),
});

export const { useGetStudentDashboardQuery, useGetStudentResultsQuery } = studentApi;
