import { Button } from "./Button";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

/** Offset-based pager: Prev/Next plus a "showing X–Y of N" summary. */
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-4 pt-3">
      <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
        {total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          Previous
        </Button>
        <span className="text-sm text-slate-600 dark:text-slate-300">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="secondary"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
