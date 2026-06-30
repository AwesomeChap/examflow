import { Link } from "react-router-dom";
import type { StudentDashboardExam } from "../../types/studentDashboard";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

const TINT = {
  blue: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20",
  amber:
    "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20",
} as const;

function formatOpensAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type StudentExamCardProps = {
  exam: StudentDashboardExam;
  /** When true, card links to the result page instead of the exam. */
  resultsMode?: boolean;
};

export function StudentExamCard({ exam, resultsMode = false }: StudentExamCardProps) {
  const locked = !exam.isOpen;
  const submitted = exam.attemptStatus === "submitted";
  const inProgress = exam.attemptStatus === "in_progress";

  const actionLabel = resultsMode
    ? "View result"
    : submitted
      ? "View result"
      : inProgress
        ? "Continue"
        : locked
          ? "Not open yet"
          : "Start exam";

  const destination = submitted || resultsMode ? `/results/${exam.id}` : `/exam/${exam.id}`;
  const canNavigate = resultsMode ? submitted : !locked && !submitted;

  return (
    <Card className={`flex h-full flex-col p-5 ${locked && !resultsMode ? "opacity-75" : ""}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{exam.title}</h3>
        {submitted && exam.score !== null ? (
          <Badge tone="success">Score: {exam.score}</Badge>
        ) : inProgress ? (
          <Badge tone="info">In progress</Badge>
        ) : locked ? (
          <Badge>Scheduled</Badge>
        ) : (
          <Badge tone="info">Available</Badge>
        )}
      </div>

      {exam.description && (
        <p className="mb-3 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
          {exam.description}
        </p>
      )}

      <dl className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
        <span>
          {exam.totalQuestions} question{exam.totalQuestions === 1 ? "" : "s"}
        </span>
        <span aria-hidden="true">·</span>
        <span>{exam.durationMin} min</span>
        {exam.startsAt && (
          <>
            <span aria-hidden="true">·</span>
            <span>Opens {formatOpensAt(exam.startsAt)}</span>
          </>
        )}
        {submitted && exam.score !== null && (
          <>
            <span aria-hidden="true">·</span>
            <span>Score {exam.score}</span>
          </>
        )}
      </dl>

      <div className="mt-auto">
        {canNavigate ? (
          <Link to={destination}>
            <Button
              variant="secondary"
              size="sm"
              className={submitted || resultsMode ? TINT.amber : TINT.blue}
            >
              {actionLabel}
            </Button>
          </Link>
        ) : (
          <Button variant="secondary" size="sm" disabled className={TINT.blue}>
            {actionLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}
