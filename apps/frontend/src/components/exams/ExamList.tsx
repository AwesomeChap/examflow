import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { Link } from "react-router-dom";
import type { ExamListItem } from "../../types/exam";
import { ExamStatusBadge } from "./ExamStatusBadge";

type ExamListProps = {
  exams: ExamListItem[];
  /** Show the creator column (used by admins viewing all exams). */
  showCreator?: boolean;
};

const ROW_HEIGHT = 84;

/**
 * Virtualized exam list. Only the rows in (and near) the viewport are mounted,
 * so the component stays smooth even for very long pages. Each row links to the
 * exam detail page.
 */
export function ExamList({ exams, showCreator = false }: ExamListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: exams.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
  });

  return (
    <div
      ref={scrollRef}
      className="h-[28rem] overflow-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      role="list"
      aria-label="Exams"
    >
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const exam = exams[virtualRow.index];
          return (
            <div
              key={exam.id}
              role="listitem"
              className="absolute left-0 top-0 w-full px-4"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <Link
                to={`/exam/${exam.id}/details`}
                className="flex h-full items-center justify-between gap-4 border-b border-slate-100 py-3 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:border-slate-800 dark:hover:bg-slate-800/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                    {exam.title}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                    {exam._count.questions} question{exam._count.questions === 1 ? "" : "s"}
                    {" · "}
                    {exam.durationMin} min
                    {showCreator && (
                      <>
                        {" · "}
                        {exam.createdBy.name}
                      </>
                    )}
                  </p>
                </div>
                <ExamStatusBadge status={exam.status} />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
