import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { ExamCardGrid } from "../components/exams/ExamCardGrid";
import { UserList } from "../components/users/UserList";
import { ButtonLink } from "../components/ui/ButtonLink";
import { StatCard } from "../components/ui/StatCard";
import { useGetAdminDashboardQuery } from "../store/adminApi";
import type { UserRole } from "../types/user";
import { StudentDashboardOverview } from "./StudentDashboardSection";

const ROLE_SUMMARY: Record<UserRole, string> = {
  admin: "Manage users, exams, and platform-wide settings.",
  teacher: "Create exams, assign them to students, and review results.",
  student: "View your scheduled exams and start them when they open.",
};

function CreateExamButton() {
  return <ButtonLink to="/exams/new">Create exam</ButtonLink>;
}

// Options for the user role filter; "" means all roles.
const ROLE_FILTERS: { value: "" | UserRole; label: string }[] = [
  { value: "student", label: "Students" },
  { value: "teacher", label: "Teachers" },
  { value: "admin", label: "Admins" },
  { value: "", label: "All roles" },
];

function AdminOverview() {
  const { data, isLoading } = useGetAdminDashboardQuery();
  // Default to students, the largest and most frequently managed cohort.
  const [roleFilter, setRoleFilter] = useState<"" | UserRole>("student");

  return (
    <div className="mt-8 space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Students" value={isLoading || !data ? "—" : data.users.students} />
        <StatCard label="Teachers" value={isLoading || !data ? "—" : data.users.teachers} />
        <StatCard label="Admins" value={isLoading || !data ? "—" : data.users.admins} />
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Users</h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="sr-only sm:not-sr-only">Filter by role</span>
              <span className="relative inline-block">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as "" | UserRole)}
                  aria-label="Filter users by role"
                  className="appearance-none rounded-lg border border-slate-300 bg-white py-1.5 pl-3 pr-7 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {ROLE_FILTERS.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </label>
            <ButtonLink to="/users/new">Create user</ButtonLink>
          </div>
        </div>
        <UserList role={roleFilter || undefined} />
      </section>
    </div>
  );
}

function TeacherOverview() {
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">My exams</h2>
        <CreateExamButton />
      </div>
      <ExamCardGrid emptyHint="You haven’t created any exams yet." />
    </section>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <section>
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
        {user.role} dashboard
      </p>
      <h1 className="mb-3 text-3xl font-bold tracking-tight">Welcome back, {user.name}</h1>
      <p className="text-slate-600 dark:text-slate-400">{ROLE_SUMMARY[user.role]}</p>

      {user.role === "admin" && <AdminOverview />}
      {user.role === "teacher" && <TeacherOverview />}
      {user.role === "student" && <StudentDashboardOverview />}
    </section>
  );
}
