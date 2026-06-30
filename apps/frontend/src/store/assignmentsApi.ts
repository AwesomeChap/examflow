import type { Student } from "../types/student";
import { api } from "./api";

type AssignmentResponse = {
  students: { assignedAt: string; student: Student }[];
};

export const assignmentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Returns the list of assigned student ids for an exam.
    getExamStudents: builder.query<string[], string>({
      query: (examId) => ({ url: `/exams/${examId}/students` }),
      transformResponse: (response: AssignmentResponse) =>
        response.students.map((a) => a.student.id),
      providesTags: (_result, _error, examId) => [{ type: "Assignment", id: examId }],
    }),

    assignStudents: builder.mutation<void, { examId: string; studentIds: string[] }>({
      query: ({ examId, studentIds }) => ({
        url: `/exams/${examId}/students`,
        method: "POST",
        body: { studentIds },
      }),
      invalidatesTags: (_result, _error, { examId }) => [
        { type: "Assignment", id: examId },
        { type: "Exam", id: examId },
        { type: "Exam", id: "LIST" },
      ],
    }),

    unassignStudent: builder.mutation<void, { examId: string; studentId: string }>({
      query: ({ examId, studentId }) => ({
        url: `/exams/${examId}/students/${studentId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { examId }) => [
        { type: "Assignment", id: examId },
        { type: "Exam", id: examId },
        { type: "Exam", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetExamStudentsQuery,
  useLazyGetExamStudentsQuery,
  useAssignStudentsMutation,
  useUnassignStudentMutation,
} = assignmentsApi;
