import type { QuestionAnalytics } from "@examflow/shared-types";

type QuestionCorrectnessListProps = {
  questions: QuestionAnalytics[];
  submitted: number;
};

/** Colour band for a correctness rate: red (hard) → amber → green (easy). */
function rateTone(rate: number): { bar: string; text: string } {
  if (rate < 40) return { bar: "bg-red-500", text: "text-red-600 dark:text-red-400" };
  if (rate < 70) return { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" };
  return { bar: "bg-green-500", text: "text-green-600 dark:text-green-400" };
}

export function QuestionCorrectnessList({ questions, submitted }: QuestionCorrectnessListProps) {
  if (questions.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">This exam has no questions yet.</p>
    );
  }

  return (
    <ul className="space-y-4">
      {questions.map((q) => {
        const tone = rateTone(q.correctRate);
        return (
          <li key={q.questionId}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <p className="min-w-0 text-sm text-slate-700 dark:text-slate-200">
                <span className="mr-1.5 font-semibold text-slate-400">#{q.order}</span>
                {q.text}
              </p>
              <span className={`shrink-0 text-sm font-semibold tabular-nums ${tone.text}`}>
                {q.correctRate}%
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
              role="progressbar"
              aria-valuenow={q.correctRate}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Question ${q.order} correctness`}
            >
              <div
                className={`h-full rounded-full ${tone.bar}`}
                style={{ width: `${q.correctRate}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {q.correct} of {submitted} correct · {q.answered} answered · {q.points} pt
              {q.points === 1 ? "" : "s"}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
