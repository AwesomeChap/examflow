import { useGetStudentDashboardQuery } from "../../store/studentApi";
import type { StudentDashboardExam } from "../../types/studentDashboard";
import { StudentExamCard } from "./StudentExamCard";

type StudentExamCardGridProps = {
  /** Filter which exams to show. Defaults to all. */
  filter?: (exam: StudentDashboardExam) => boolean;
  emptyHint?: string;
};

export function StudentExamCardGrid({
  filter,
  emptyHint = "Nothing here yet.",
}: StudentExamCardGridProps) {
  const { data, isLoading, isError } = useGetStudentDashboardQuery();

  if (isLoading) {
    return (
      <p role="status" className="text-slate-500 dark:text-slate-400">
        Loading…
      </p>
    );
  }

  if (isError) {
    return (
      <p role="alert" className="text-red-600 dark:text-red-400">
        Could not load exams. Please try again.
      </p>
    );
  }

  const exams = (data ?? []).filter(filter ?? (() => true));

  if (exams.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {emptyHint}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {exams.map((exam) => (
        <li key={exam.id}>
          <StudentExamCard exam={exam} />
        </li>
      ))}
    </ul>
  );
}
