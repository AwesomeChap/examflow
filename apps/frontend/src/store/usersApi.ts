import type { AdminUser } from "../types/adminUser";
import type { UserRole } from "../types/user";
import type { Paginated } from "../types/exam";
import { api } from "./api";

export type UserListParams = {
  page: number;
  pageSize: number;
  /** Optional role filter; omitted returns all roles. */
  role?: UserRole;
};

type UserListResponse = {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
};

export type CreateUserBody = {
  name: string;
  role: "teacher" | "student";
  password: string;
};

export const usersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<Paginated<AdminUser>, UserListParams>({
      query: ({ page, pageSize, role }) => ({
        url: "/admin/users",
        params: { page, pageSize, ...(role ? { role } : {}) },
      }),
      transformResponse: (response: UserListResponse) => ({
        items: response.users,
        total: response.total,
        page: response.page,
        pageSize: response.pageSize,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((user) => ({ type: "User" as const, id: user.id })),
              { type: "User" as const, id: "LIST" },
            ]
          : [{ type: "User" as const, id: "LIST" }],
    }),

    createUser: builder.mutation<AdminUser, CreateUserBody>({
      query: (body) => ({ url: "/admin/users", method: "POST", body }),
      transformResponse: (response: { user: AdminUser }) => response.user,
      invalidatesTags: [{ type: "User", id: "LIST" }, "AdminDashboard"],
    }),

    deactivateUser: builder.mutation<AdminUser, string>({
      query: (userId) => ({ url: `/admin/users/${userId}`, method: "DELETE" }),
      transformResponse: (response: { user: AdminUser }) => response.user,
      invalidatesTags: (_result, _error, userId) => [
        { type: "User", id: userId },
        { type: "User", id: "LIST" },
        "AdminDashboard",
      ],
    }),

    reactivateUser: builder.mutation<AdminUser, string>({
      query: (userId) => ({ url: `/admin/users/${userId}/reactivate`, method: "POST" }),
      transformResponse: (response: { user: AdminUser }) => response.user,
      invalidatesTags: (_result, _error, userId) => [
        { type: "User", id: userId },
        { type: "User", id: "LIST" },
        "AdminDashboard",
      ],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useCreateUserMutation,
  useDeactivateUserMutation,
  useReactivateUserMutation,
} = usersApi;
