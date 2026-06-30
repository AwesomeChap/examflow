import { StudentExamCardGrid } from "../components/exams/StudentExamCardGrid";

/** Available exams: not yet submitted (includes scheduled/locked ones). */
export function StudentDashboardOverview() {
  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-semibold">Your exams</h2>
      <StudentExamCardGrid
        filter={(exam) => exam.attemptStatus !== "submitted"}
        emptyHint="No exams are assigned to you yet."
      />
    </section>
  );
}
