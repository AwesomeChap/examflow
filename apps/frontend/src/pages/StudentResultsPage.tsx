import { StudentAttemptCard } from "../components/exams/StudentAttemptCard";
import { useGetStudentResultsQuery } from "../store/studentApi";

export function StudentResultsPage() {
  const { data: results, isLoading, isError } = useGetStudentResultsQuery();

  return (
    <section>
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
        Results
      </p>
      <h1 className="mb-3 text-3xl font-bold tracking-tight">Your results</h1>
      <p className="text-slate-600 dark:text-slate-400">
        Every exam attempt you have submitted. Retake an exam from the dashboard to add another.
      </p>

      <div className="mt-8">
        {isLoading ? (
          <p role="status" className="text-slate-500 dark:text-slate-400">
            Loading…
          </p>
        ) : isError ? (
          <p role="alert" className="text-red-600 dark:text-red-400">
            Could not load your results. Please try again.
          </p>
        ) : (results ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
            You haven't completed any exams yet.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(results ?? []).map((attempt) => (
              <li key={attempt.id}>
                <StudentAttemptCard attempt={attempt} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
