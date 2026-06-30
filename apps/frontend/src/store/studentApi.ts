import type { StudentDashboardExam } from "../types/studentDashboard";
import { api } from "./api";

export const studentApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getStudentDashboard: builder.query<StudentDashboardExam[], void>({
      query: () => ({ url: "/student/dashboard" }),
      transformResponse: (response: { exams: StudentDashboardExam[] }) => response.exams,
      providesTags: [{ type: "StudentDashboard", id: "LIST" }],
    }),
  }),
});

export const { useGetStudentDashboardQuery } = studentApi;
