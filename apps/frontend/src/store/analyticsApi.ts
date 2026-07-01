import type { ExamAnalytics } from "@examflow/shared-types";
import { api } from "./api";

export const analyticsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getExamAnalytics: builder.query<ExamAnalytics, string>({
      query: (examId) => ({ url: `/exams/${examId}/analytics` }),
      transformResponse: (response: { analytics: ExamAnalytics }) => response.analytics,
      providesTags: (_result, _error, examId) => [{ type: "Analytics", id: examId }],
    }),
  }),
});

export const { useGetExamAnalyticsQuery } = analyticsApi;
