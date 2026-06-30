import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { ExamCardGrid } from "../components/exams/ExamCardGrid";
import { Button } from "../components/ui/Button";
import { StatCard } from "../components/ui/StatCard";
import { useGetAdminDashboardQuery } from "../store/adminApi";
import type { UserRole } from "../types/user";

const ROLE_SUMMARY: Record<UserRole, string> = {
  admin: "Manage users, exams, and platform-wide settings.",
  teacher: "Create exams, assign them to students, and review results.",
  student: "View your scheduled exams and start them when they open.",
};

function CreateExamButton() {
  return (
    <Link to="/exams/new">
      <Button>Create exam</Button>
    </Link>
  );
}

function AdminOverview() {
  const { data, isLoading } = useGetAdminDashboardQuery();

  return (
    <div className="mt-8 space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Students" value={isLoading || !data ? "—" : data.users.students} />
        <StatCard label="Teachers" value={isLoading || !data ? "—" : data.users.teachers} />
        <StatCard label="Exams" value={isLoading || !data ? "—" : data.exams} />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">All exams</h2>
          <CreateExamButton />
        </div>
        <ExamCardGrid showCreator emptyHint="No exams have been created yet." />
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
    </section>
  );
}
