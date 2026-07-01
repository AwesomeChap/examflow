import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/**
 * Single RTK Query API slice. Feature endpoints are injected from their own
 * files (`examsApi`, `adminApi`, …) to keep this module dependency-light and
 * the store assembled in one place. `credentials: "include"` ensures the
 * HttpOnly auth cookie rides along with every request.
 */
export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: API_BASE_URL, credentials: "include" }),
  tagTypes: [
    "Exam",
    "Question",
    "Assignment",
    "Student",
    "AdminDashboard",
    "StudentDashboard",
    "Attempt",
    "Analytics",
  ],
  endpoints: () => ({}),
});
