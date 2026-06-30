import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { ExamList } from "../components/exams/ExamList";
import { Pagination } from "../components/ui/Pagination";
import { useGetExamsQuery } from "../store/examsApi";

const PAGE_SIZE = 10;

export function ExamListPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, isFetching } = useGetExamsQuery({ page, pageSize: PAGE_SIZE });

  return (
    <section>
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">
          {isAdmin ? "Manage Exams" : "My Exams"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isAdmin
            ? "Every exam across the platform."
            : "Exams you have created."}
        </p>
      </header>

      {isLoading ? (
        <p role="status" className="text-slate-500 dark:text-slate-400">
          Loading exams…
        </p>
      ) : isError ? (
        <p role="alert" className="text-red-600 dark:text-red-400">
          Could not load exams. Please try again.
        </p>
      ) : !data || data.total === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No exams yet.
        </p>
      ) : (
        <div aria-busy={isFetching}>
          <ExamList exams={data.items} showCreator={isAdmin} />
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={setPage}
          />
        </div>
      )}
    </section>
  );
}
