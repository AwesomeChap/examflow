import { useAuth } from "../auth/useAuth";
import type { UserRole } from "../types/user";

const ROLE_SUMMARY: Record<UserRole, string> = {
  admin: "Manage users, exams, and platform-wide settings.",
  teacher: "Create exams, assign them to students, and review results.",
  student: "View your scheduled exams and start them when they open.",
};

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
    </section>
  );
}
