import type { AdminDashboard } from "@examflow/shared-types";
import { api } from "./api";

export const adminApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAdminDashboard: builder.query<AdminDashboard, void>({
      query: () => ({ url: "/admin/dashboard" }),
      providesTags: ["AdminDashboard"],
    }),
  }),
});

export const { useGetAdminDashboardQuery } = adminApi;
