import { Link, useParams } from "react-router-dom";
import { ExamStatusBadge } from "../components/exams/ExamStatusBadge";
import { Card } from "../components/ui/Card";
import { useGetExamQuery } from "../store/examsApi";

function formatDateTime(value: string | null): string {
  if (!value) return "Available immediately";
  return new Date(value).toLocaleString();
}

export function ExamDetailPage() {
  const { examId = "" } = useParams();
  const { data: exam, isLoading, isError } = useGetExamQuery(examId, { skip: !examId });

  if (isLoading) {
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
        <Link to="/exams" className="mt-3 inline-block text-blue-600 dark:text-blue-400">
          Back to exams
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <Link
          to="/exams"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Back to exams
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{exam.title}</h1>
          <ExamStatusBadge status={exam.status} />
        </div>
        {exam.description && (
          <p className="mt-2 text-slate-600 dark:text-slate-400">{exam.description}</p>
        )}
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Details
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Duration</dt>
            <dd className="mt-0.5 font-medium">{exam.durationMin} minutes</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Opens</dt>
            <dd className="mt-0.5 font-medium">{formatDateTime(exam.startsAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Created by</dt>
            <dd className="mt-0.5 font-medium">{exam.createdBy.name}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Analytics
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          Analytics for this exam will appear here.
        </p>
      </Card>
    </section>
  );
}
