import { api } from "./api";

export type AdminDashboard = {
  users: { admins: number; teachers: number; students: number };
  exams: number;
};

export const adminApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAdminDashboard: builder.query<AdminDashboard, void>({
      query: () => ({ url: "/admin/dashboard" }),
      providesTags: ["AdminDashboard"],
    }),
  }),
});

export const { useGetAdminDashboardQuery } = adminApi;
