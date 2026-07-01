import type { AttemptSummary } from "@examflow/shared-types";
import { Badge } from "../ui/Badge";
import { ButtonLink } from "../ui/ButtonLink";
import { Card } from "../ui/Card";

const TINT_AMBER =
  "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20";

function formatSubmittedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type StudentAttemptCardProps = {
  attempt: AttemptSummary;
};

export function StudentAttemptCard({ attempt }: StudentAttemptCardProps) {
  const tone = attempt.percentage >= 50 ? "success" : "warning";

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900 dark:text-slate-100">
            {attempt.title}
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Attempt {attempt.attemptNumber}
          </p>
        </div>
        <Badge tone={tone}>{attempt.percentage}%</Badge>
      </div>

      <dl className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
        <span>
          Score {attempt.score}/{attempt.maxScore}
        </span>
        {attempt.submittedAt && (
          <>
            <span aria-hidden="true">·</span>
            <span>Submitted {formatSubmittedAt(attempt.submittedAt)}</span>
          </>
        )}
      </dl>

      <div className="mt-auto">
        <ButtonLink
          to={`/results/${attempt.examId}/${attempt.id}`}
          variant="secondary"
          size="sm"
          className={TINT_AMBER}
        >
          View result
        </ButtonLink>
      </div>
    </Card>
  );
}
