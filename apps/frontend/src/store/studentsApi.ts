import type { Student } from "../types/student";
import { api } from "./api";

export const studentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getStudents: builder.query<Student[], void>({
      query: () => ({ url: "/students" }),
      transformResponse: (response: { students: Student[] }) => response.students,
      providesTags: [{ type: "Student", id: "LIST" }],
    }),
  }),
});

export const { useGetStudentsQuery } = studentsApi;
