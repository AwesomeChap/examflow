import type { ExamAssignment } from "@examflow/shared-types";
import { api } from "./api";

export const assignmentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getExamStudents: builder.query<string[], string>({
      query: (examId) => ({ url: `/exams/${examId}/students` }),
      transformResponse: (response: { students: ExamAssignment[] }) =>
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
