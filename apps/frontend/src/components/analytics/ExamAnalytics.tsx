import { useMemo } from "react";
import { formatDuration } from "../../lib/formatTime";
import { useGetExamAnalyticsQuery } from "../../store/analyticsApi";
import type { QuestionAnalytics } from "../../types/analytics";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { StatCard } from "../ui/StatCard";
import { QuestionCorrectnessList } from "./QuestionCorrectnessList";
import { ScoreDistributionChart } from "./ScoreDistributionChart";

type ExamAnalyticsProps = {
  examId: string;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {children}
    </h2>
  );
}

export function ExamAnalytics({ examId }: ExamAnalyticsProps) {
  const { data, isLoading, isError } = useGetExamAnalyticsQuery(examId, { skip: !examId });

  const { hardest, easiest } = useMemo(() => {
    const answered = (data?.questions ?? []).filter((q) => q.answered > 0);
    if (answered.length === 0) return { hardest: [], easiest: [] as QuestionAnalytics[] };
    const byRate = [...answered].sort((a, b) => a.correctRate - b.correctRate);
    return {
      hardest: byRate.slice(0, 3),
      easiest: [...byRate].reverse().slice(0, 3),
    };
  }, [data]);

  if (isLoading) {
    return (
      <p role="status" className="text-slate-500 dark:text-slate-400">
        Loading analytics…
      </p>
    );
  }

  if (isError || !data) {
    return (
      <p role="alert" className="text-red-600 dark:text-red-400">
        Could not load analytics for this exam.
      </p>
    );
  }

  const { attempts, score, timing, questions, exam } = data;

  if (attempts.submitted === 0) {
    return (
      <Card className="p-6">
        <SectionTitle>Analytics</SectionTitle>
        <p className="text-slate-500 dark:text-slate-400">
          No submissions yet. Results will appear here once students complete the exam
          {attempts.inProgress > 0
            ? ` (${attempts.inProgress} attempt${attempts.inProgress === 1 ? "" : "s"} in progress).`
            : "."}
        </p>
      </Card>
    );
  }

  const stdDevPercentage = exam.maxScore > 0 ? (score.stdDev / exam.maxScore) * 100 : 0;

  return (
    <section className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total submissions" value={attempts.submitted} />
        <StatCard label="Average score" value={`${score.averagePercentage}%`} />
        <StatCard label="Avg. time taken" value={formatDuration(timing.averageDurationMs)} />
      </div>

      {/* Score distribution / normal curve */}
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Score distribution</SectionTitle>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge tone="info">Mean {score.averagePercentage}%</Badge>
            {score.medianScore !== null && exam.maxScore > 0 && (
              <Badge tone="neutral">
                Median {Math.round((score.medianScore / exam.maxScore) * 100)}%
              </Badge>
            )}
            <Badge tone="neutral">σ {stdDevPercentage.toFixed(1)}%</Badge>
          </div>
        </div>
        <ScoreDistributionChart
          distribution={score.distribution}
          meanPercentage={score.averagePercentage}
          stdDevPercentage={stdDevPercentage}
          sampleCount={attempts.submitted}
        />
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm dark:border-slate-800 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Highest</dt>
            <dd className="mt-0.5 font-semibold">
              {score.highestScore ?? "—"}/{exam.maxScore}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Lowest</dt>
            <dd className="mt-0.5 font-semibold">
              {score.lowestScore ?? "—"}/{exam.maxScore}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Average</dt>
            <dd className="mt-0.5 font-semibold">
              {score.averageScore}/{exam.maxScore}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Median time</dt>
            <dd className="mt-0.5 font-semibold">{formatDuration(timing.medianDurationMs)}</dd>
          </div>
        </dl>
      </Card>

      {/* Overview: struggling vs. mastered */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle>Most challenging</SectionTitle>
          {hardest.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Not enough data yet.</p>
          ) : (
            <ul className="space-y-3">
              {hardest.map((q) => (
                <li key={q.questionId} className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm text-slate-700 dark:text-slate-200">
                    <span className="mr-1.5 font-semibold text-slate-400">#{q.order}</span>
                    {q.text}
                  </p>
                  <Badge tone="warning">{q.correctRate}% correct</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>Best understood</SectionTitle>
          {easiest.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Not enough data yet.</p>
          ) : (
            <ul className="space-y-3">
              {easiest.map((q) => (
                <li key={q.questionId} className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm text-slate-700 dark:text-slate-200">
                    <span className="mr-1.5 font-semibold text-slate-400">#{q.order}</span>
                    {q.text}
                  </p>
                  <Badge tone="success">{q.correctRate}% correct</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Per-question correctness */}
      <Card className="p-5">
        <SectionTitle>Per-question correctness</SectionTitle>
        <QuestionCorrectnessList questions={questions} submitted={attempts.submitted} />
      </Card>
    </section>
  );
}
