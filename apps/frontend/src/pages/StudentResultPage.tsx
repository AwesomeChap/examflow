import { Link, useParams } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { ButtonLink } from "../components/ui/ButtonLink";
import { Card } from "../components/ui/Card";
import { useGetAttemptResultQuery, useGetStudentExamQuery } from "../store/attemptsApi";
import { formatAnswerDisplay } from "../lib/formatAnswer";

export function StudentResultPage() {
  const { examId = "", attemptId = "" } = useParams();
  const { data: exam, isLoading: loadingExam } = useGetStudentExamQuery(examId, { skip: !examId });
  const { data: result, isLoading: loadingResult, isError } = useGetAttemptResultQuery(
    { examId, attemptId },
    { skip: !examId || !attemptId },
  );

  if (loadingExam || loadingResult) {
    return (
      <p role="status" className="text-slate-500 dark:text-slate-400">
        Loading result…
      </p>
    );
  }

  if (isError || !result) {
    return (
      <section className="space-y-4">
        <p role="alert" className="text-red-600 dark:text-red-400">
          Result not found. You may not have submitted this exam yet.
        </p>
        <Link to="/results" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Back to results
        </Link>
      </section>
    );
  }

  const questionById = new Map((exam?.questions ?? []).map((q) => [q.id, q]));

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to="/results"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Back to results
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{exam?.title ?? "Exam result"}</h1>
        {result.submittedAt && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Submitted {new Date(result.submittedAt).toLocaleString()}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">Score</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {result.score}/{result.maxScore}
          </p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">Percentage</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{result.percentage}%</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">Correct</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {result.correctCount}/{result.totalQuestions}
          </p>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Breakdown</h2>
        <ol className="space-y-3">
          {result.breakdown.map((item, index) => {
            const question = questionById.get(item.questionId);
            const tone =
              item.isCorrect === true ? "success" : item.isCorrect === false ? "warning" : "neutral";
            const label =
              item.isCorrect === true ? "Correct" : item.isCorrect === false ? "Incorrect" : "Unanswered";

            return (
              <li key={item.questionId}>
                <Card className="p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-400">#{index + 1}</span>
                    <Badge tone={tone}>{label}</Badge>
                    <Badge>
                      {item.awardedPoints}/{item.points} pt{item.points === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {question?.text ?? "Question"}
                  </p>
                  {item.value != null && (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                      Your answer:{" "}
                      <span className="font-medium">{formatAnswerDisplay(item.value)}</span>
                    </p>
                  )}
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Correct answer:{" "}
                    <span className="font-medium text-green-700 dark:text-green-400">
                      {formatAnswerDisplay(item.correctAnswer)}
                    </span>
                  </p>
                </Card>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-8 dark:border-slate-800">
        <ButtonLink to="/dashboard" variant="secondary">
          Back to dashboard
        </ButtonLink>
      </div>
    </section>
  );
}
