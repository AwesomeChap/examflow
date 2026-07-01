import type { StudentDashboardExam } from "@examflow/shared-types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ButtonLink } from "../ui/ButtonLink";
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

function attemptsLabel(exam: StudentDashboardExam): string {
  if (exam.maxAttempts === null) {
    return `Unlimited attempts · ${exam.attemptsUsed} used`;
  }
  return `Attempt ${Math.min(exam.attemptsUsed + 1, exam.maxAttempts)} of ${exam.maxAttempts}`;
}

type StudentExamCardProps = {
  exam: StudentDashboardExam;
};

export function StudentExamCard({ exam }: StudentExamCardProps) {
  const locked = !exam.isOpen;
  const submitted = exam.attemptStatus === "submitted";
  const inProgress = exam.attemptStatus === "in_progress";
  const attemptsLeft = exam.attemptsRemaining === null || exam.attemptsRemaining > 0;
  const canRetake = submitted && attemptsLeft && !locked;

  // "View result" is the fallback once no attempts remain (or as a secondary
  // action). It links to the best attempt's breakdown.
  const showViewResult = submitted && exam.bestAttemptId !== null;

  const primaryLabel = inProgress
    ? "Continue"
    : locked
      ? "Not open yet"
      : canRetake
        ? "Retake"
        : submitted
          ? "View result"
          : "Start exam";

  const primaryTo =
    submitted && !canRetake && !inProgress
      ? `/results/${exam.id}/${exam.bestAttemptId}`
      : `/exam/${exam.id}`;
  const primaryDisabled = locked || (submitted && !canRetake && !showViewResult);

  return (
    <Card className={`flex h-full flex-col p-5 ${locked ? "opacity-75" : ""}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{exam.title}</h3>
        {submitted && exam.score !== null ? (
          <Badge tone="success">Best: {exam.score}</Badge>
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
        <span aria-hidden="true">·</span>
        <span>{attemptsLabel(exam)}</span>
        {exam.startsAt && (
          <>
            <span aria-hidden="true">·</span>
            <span>Opens {formatOpensAt(exam.startsAt)}</span>
          </>
        )}
      </dl>

      <div className="mt-auto flex flex-wrap gap-2">
        {primaryDisabled ? (
          <Button variant="secondary" size="sm" disabled className={TINT.blue}>
            {primaryLabel}
          </Button>
        ) : (
          <ButtonLink
            to={primaryTo}
            variant="secondary"
            size="sm"
            className={submitted && !canRetake ? TINT.amber : TINT.blue}
          >
            {primaryLabel}
          </ButtonLink>
        )}

        {/* When a retake is offered, still let the student review their best result. */}
        {canRetake && showViewResult && (
          <ButtonLink
            to={`/results/${exam.id}/${exam.bestAttemptId}`}
            variant="secondary"
            size="sm"
            className={TINT.amber}
          >
            View result
          </ButtonLink>
        )}
      </div>
    </Card>
  );
}
