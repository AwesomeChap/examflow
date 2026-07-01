import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ExamQuestionPanel } from "../components/exams/ExamQuestionPanel";
import { ExamStatusBadge } from "../components/exams/ExamStatusBadge";
import { Button } from "../components/ui/Button";
import { ButtonLink } from "../components/ui/ButtonLink";
import { Card } from "../components/ui/Card";
import { useGetExamQuery } from "../store/examsApi";
import { useGetExamQuestionsQuery } from "../store/questionsApi";

/**
 * Read-only exam preview for staff. Reuses the student exam question panel so
 * a teacher can review exactly what a student sees — but with the correct
 * answers highlighted and no attempt/submission (staff never take exams).
 */
export function ExamPreviewPage() {
  const { examId = "" } = useParams();
  const { data: exam, isLoading: loadingExam, isError } = useGetExamQuery(examId, { skip: !examId });
  const { data: questions, isLoading: loadingQuestions } = useGetExamQuestionsQuery(examId, {
    skip: !examId,
  });

  const ordered = useMemo(
    () => (questions ? [...questions].sort((a, b) => a.order - b.order) : []),
    [questions],
  );
  const [index, setIndex] = useState(0);

  if (loadingExam || loadingQuestions) {
    return (
      <p role="status" className="text-slate-500 dark:text-slate-400">
        Loading exam…
      </p>
    );
  }

  if (isError || !exam) {
    return (
      <div>
        <p role="alert" className="text-red-600 dark:text-red-400">
          Exam not found or you do not have access to it.
        </p>
        <Link to="/dashboard" className="mt-3 inline-block text-blue-600 dark:text-blue-400">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const current = ordered[index];

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/dashboard" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Back to dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{exam.title}</h1>
            <ExamStatusBadge status={exam.status} />
          </div>
          <ButtonLink to={`/exam/${exam.id}/details`} variant="secondary" size="sm">
            Details
          </ButtonLink>
        </div>
        {exam.description && (
          <p className="mt-2 text-slate-600 dark:text-slate-400">{exam.description}</p>
        )}
      </div>

      <p
        role="note"
        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
      >
        Preview mode — correct answers are highlighted. This exam cannot be submitted.
      </p>

      {ordered.length === 0 || !current ? (
        <Card className="p-6">
          <p className="text-slate-500 dark:text-slate-400">This exam has no questions yet.</p>
        </Card>
      ) : (
        <>
          <Card className="p-6">
            <ExamQuestionPanel
              question={current}
              index={index}
              total={ordered.length}
              correctValue={current.correctAnswer}
            />

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={index === 0}
                onClick={() => setIndex((i) => i - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={index >= ordered.length - 1}
                onClick={() => setIndex((i) => i + 1)}
              >
                Next
              </Button>
            </div>
          </Card>
        </>
      )}
    </section>
  );
}
