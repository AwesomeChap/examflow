import { Link } from "react-router-dom";
import { isExamEditable } from "../../lib/examRules";
import type { ExamListItem } from "../../types/exam";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ExamStatusBadge } from "./ExamStatusBadge";

type ExamCardProps = {
  exam: ExamListItem;
  showCreator?: boolean;
  onClone: (examId: string) => void;
  cloning?: boolean;
};

export function ExamCard({ exam, showCreator = false, onClone, cloning }: ExamCardProps) {
  const editable = isExamEditable(exam);
  const { questions, attempts, assignments } = exam._count;

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <Link
          to={`/exam/${exam.id}/details`}
          className="font-semibold text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-100"
        >
          {exam.title}
        </Link>
        <ExamStatusBadge status={exam.status} />
      </div>

      {exam.description && (
        <p className="mb-3 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
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
          <Button variant="secondary" size="sm">
            Analytics
          </Button>
        </Link>
        {editable && (
          <Link to={`/exam/${exam.id}/edit`}>
            <Button variant="secondary" size="sm">
              Edit
            </Button>
          </Link>
        )}
        <Button variant="secondary" size="sm" onClick={() => onClone(exam.id)} disabled={cloning}>
          {cloning ? "Cloning…" : "Clone"}
        </Button>
        {!editable && <span className="ml-auto text-xs text-slate-400">Locked</span>}
      </div>
    </Card>
  );
}
