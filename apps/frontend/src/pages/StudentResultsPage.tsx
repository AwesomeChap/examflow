import { StudentExamCardGrid } from "../components/exams/StudentExamCardGrid";

export function StudentResultsPage() {
  return (
    <section>
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
        Results
      </p>
      <h1 className="mb-3 text-3xl font-bold tracking-tight">Your results</h1>
      <p className="text-slate-600 dark:text-slate-400">
        Exams you have completed and submitted.
      </p>

      <div className="mt-8">
        <StudentExamCardGrid
          resultsMode
          filter={(exam) => exam.attemptStatus === "submitted"}
          emptyHint="You haven't completed any exams yet."
        />
      </div>
    </section>
  );
}
