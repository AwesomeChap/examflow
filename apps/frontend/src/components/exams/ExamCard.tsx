import { Link } from "react-router-dom";
import { isExamEditable } from "../../lib/examRules";
import type { ExamListItem } from "../../types/exam";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ExamStatusBadge } from "./ExamStatusBadge";

const TINT = {
  amber:
    "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20",
  blue: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20",
  red: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20",
} as const;

type ExamCardProps = {
  exam: ExamListItem;
  showCreator?: boolean;
  onClone: (examId: string) => void;
  cloning?: boolean;
  onDiscard?: (examId: string) => void;
  discarding?: boolean;
};

export function ExamCard({ exam, showCreator = false, onClone, cloning, onDiscard, discarding }: ExamCardProps) {
  const editable = isExamEditable(exam);
  const isDraft = exam.status === "draft";
  const { questions, attempts, assignments } = exam._count;

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <Link
          to={`/exam/${exam.id}/preview`}
          className="font-semibold text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-100"
        >
          {exam.title}
        </Link>
        <ExamStatusBadge status={exam.status} />
      </div>

      {exam.description && (
        <p className="mb-3 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">
          {exam.description}
        </p>
      )}

      <dl className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
        <span>
          {questions} question{questions === 1 ? "" : "s"}
        </span>
        <span aria-hidden="true">·</span>
        <span>{exam.durationMin} min</span>
        <span aria-hidden="true">·</span>
        <span>
          {assignments} assigned
        </span>
        {attempts > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span>
              {attempts} result{attempts === 1 ? "" : "s"}
            </span>
          </>
        )}
        {showCreator && (
          <>
            <span aria-hidden="true">·</span>
            <span>by {exam.createdBy.name}</span>
          </>
        )}
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Link to={`/exam/${exam.id}/details`}>
          <Button variant="secondary" size="sm" className={TINT.amber}>
            Details
          </Button>
        </Link>
        {editable && (
          <Link to={`/exam/${exam.id}/edit`}>
            <Button variant="secondary" size="sm" className={TINT.blue}>
              Edit
            </Button>
          </Link>
        )}
        <Button variant="secondary" size="sm" onClick={() => onClone(exam.id)} disabled={cloning}>
          {cloning ? "Cloning…" : "Clone"}
        </Button>
        {onDiscard && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onDiscard(exam.id)}
            disabled={discarding}
            className={TINT.red}
          >
            {discarding ? (isDraft ? "Discarding…" : "Deleting…") : isDraft ? "Discard" : "Delete"}
          </Button>
        )}
        {!editable && <span className="ml-auto text-xs text-slate-400">Locked</span>}
      </div>
    </Card>
  );
}
