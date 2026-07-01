/**
 * Pure aggregation helpers for per-exam teacher analytics. Kept free of Prisma
 * so the math (averages, distribution buckets, per-question rates) is trivially
 * unit-testable; the route is responsible for fetching the rows.
 *
 * Only *submitted* attempts contribute to score/correctness statistics —
 * in-progress attempts have no final score and ungraded answers.
 */

type AnalyticsExam = {
  id: string;
  title: string;
};

type AnalyticsQuestion = {
  id: string;
  order: number;
  text: string;
  type: "mcq" | "true_false";
  points: number;
};

type AnalyticsAttempt = {
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
};

type AnalyticsAnswer = {
  questionId: string;
  isCorrect: boolean | null;
};

// Five fixed percentage bands for the score distribution. 100% lands in the
// final (inclusive) bucket.
const DISTRIBUTION_BANDS = [
  { label: "0-20", min: 0, max: 20 },
  { label: "20-40", min: 20, max: 40 },
  { label: "40-60", min: 40, max: 60 },
  { label: "60-80", min: 60, max: 80 },
  { label: "80-100", min: 80, max: 100 },
] as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Median of a numeric list. Returns null for an empty list. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Population standard deviation. Returns 0 for fewer than two values. */
function stdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function buildExamAnalytics(
  exam: AnalyticsExam,
  questions: AnalyticsQuestion[],
  attempts: AnalyticsAttempt[],
  answers: AnalyticsAnswer[],
  assignedStudents: number,
) {
  const maxScore = questions.reduce((sum, q) => sum + q.points, 0);

  const submitted = attempts.filter((a) => a.submittedAt !== null);
  const submittedCount = submitted.length;
  const scores = submitted.map((a) => a.score ?? 0);

  // ----- Score summary -----
  const totalScore = scores.reduce((sum, s) => sum + s, 0);
  const averageScore = submittedCount > 0 ? round2(totalScore / submittedCount) : 0;
  const toPct = (score: number) => (maxScore > 0 ? (score / maxScore) * 100 : 0);
  const averagePercentage =
    submittedCount > 0 ? round2(toPct(totalScore / submittedCount)) : 0;
  const highestScore = submittedCount > 0 ? Math.max(...scores) : null;
  const lowestScore = submittedCount > 0 ? Math.min(...scores) : null;

  // Median + standard deviation let the client draw a normal-distribution
  // (bell) curve over the histogram. Kept in the score domain; because
  // percentage is a linear transform of score, the client can rescale by
  // maxScore without losing accuracy.
  const meanScore = submittedCount > 0 ? totalScore / submittedCount : 0;
  const medianScore = median(scores);
  const stdDevScore = round2(stdDev(scores, meanScore));

  // ----- Score distribution (by percentage band) -----
  const distribution = DISTRIBUTION_BANDS.map((band) => ({
    ...band,
    count: 0,
  }));
  for (const score of scores) {
    const pct = toPct(score);
    const index = Math.min(
      DISTRIBUTION_BANDS.length - 1,
      Math.floor(pct / 20),
    );
    distribution[index].count += 1;
  }

  // ----- Per-question correctness -----
  const answeredByQuestion = new Map<string, number>();
  const correctByQuestion = new Map<string, number>();
  for (const answer of answers) {
    answeredByQuestion.set(
      answer.questionId,
      (answeredByQuestion.get(answer.questionId) ?? 0) + 1,
    );
    if (answer.isCorrect === true) {
      correctByQuestion.set(
        answer.questionId,
        (correctByQuestion.get(answer.questionId) ?? 0) + 1,
      );
    }
  }

  // ----- Completion time (submitted attempts only) -----
  const durationsMs = submitted
    .map((a) =>
      a.submittedAt ? a.submittedAt.getTime() - a.startedAt.getTime() : null,
    )
    .filter((d): d is number => d !== null && d >= 0);
  const averageDurationMs =
    durationsMs.length > 0
      ? Math.round(durationsMs.reduce((sum, d) => sum + d, 0) / durationsMs.length)
      : null;
  const medianDurationMsRaw = median(durationsMs);
  const medianDurationMs =
    medianDurationMsRaw === null ? null : Math.round(medianDurationMsRaw);

  // ----- Per-question correctness -----
  const perQuestion = questions.map((q) => {
    const answered = answeredByQuestion.get(q.id) ?? 0;
    const correct = correctByQuestion.get(q.id) ?? 0;
    // Rate is over all submitted attempts: an unanswered question counts as
    // not-correct, which reflects how many test-takers actually got it right.
    const correctRate =
      submittedCount > 0 ? round2((correct / submittedCount) * 100) : 0;
    return {
      questionId: q.id,
      order: q.order,
      text: q.text,
      type: q.type,
      points: q.points,
      answered,
      correct,
      correctRate,
    };
  });

  return {
    exam: {
      id: exam.id,
      title: exam.title,
      totalQuestions: questions.length,
      maxScore,
    },
    attempts: {
      total: attempts.length,
      submitted: submittedCount,
      inProgress: attempts.length - submittedCount,
      assignedStudents,
      completionRate:
        assignedStudents > 0
          ? round2((submittedCount / assignedStudents) * 100)
          : 0,
    },
    score: {
      averageScore,
      averagePercentage,
      highestScore,
      lowestScore,
      medianScore,
      stdDev: stdDevScore,
      distribution,
    },
    timing: {
      averageDurationMs,
      medianDurationMs,
    },
    questions: perQuestion,
  };
}
