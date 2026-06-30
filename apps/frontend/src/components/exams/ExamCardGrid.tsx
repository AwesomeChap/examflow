import { useState } from "react";
import { useCloneExam } from "../../hooks/useCloneExam";
import { useGetExamsQuery } from "../../store/examsApi";
import { Pagination } from "../ui/Pagination";
import { ExamCard } from "./ExamCard";

type ExamCardGridProps = {
  /** Show the exam creator on each card (admins viewing every exam). */
  showCreator?: boolean;
  emptyHint?: string;
  pageSize?: number;
};

export function ExamCardGrid({
  showCreator = false,
  emptyHint = "No exams yet. Create your first one.",
  pageSize = 9,
}: ExamCardGridProps) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, isFetching } = useGetExamsQuery({ page, pageSize });
  const { clone, cloningId, error: cloneError } = useCloneExam();

  if (isLoading) {
    return (
      <p role="status" className="text-slate-500 dark:text-slate-400">
        Loading exams…
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

  if (!data || data.total === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {emptyHint}
      </p>
    );
  }

  return (
    <div aria-busy={isFetching}>
      {cloneError && (
        <p role="alert" className="mb-3 text-sm font-medium text-red-600 dark:text-red-400">
          {cloneError}
        </p>
      )}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((exam) => (
          <li key={exam.id}>
            <ExamCard
              exam={exam}
              showCreator={showCreator}
              onClone={clone}
              cloning={cloningId === exam.id}
            />
          </li>
        ))}
      </ul>
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
    </div>
  );
}
