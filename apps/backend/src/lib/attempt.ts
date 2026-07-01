import { prisma } from "./prisma.js";

/**
 * Attempt timing + grading helpers.
 *
 * The exam time limit is enforced entirely on the backend: the deadline is
 * derived from the attempt's immutable `startedAt` plus the exam's
 * `durationMin`. The client is never trusted to report elapsed time. Any
 * interaction with an expired-but-open attempt (reading state, answering, or
 * submitting) lazily finalizes it, so a student can never record answers past
 * the limit even if no explicit submit ever arrives.
 */

const MS_PER_MINUTE = 60_000;

/** Absolute moment the attempt's time runs out. */
export function attemptDeadline(startedAt: Date, durationMin: number): Date {
  return new Date(startedAt.getTime() + durationMin * MS_PER_MINUTE);
}

/** True once the time limit has elapsed for an attempt. */
export function isAttemptExpired(
  startedAt: Date,
  durationMin: number,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= attemptDeadline(startedAt, durationMin).getTime();
}

/** Milliseconds left before auto-submit (never negative). */
export function remainingMs(
  startedAt: Date,
  durationMin: number,
  now: Date = new Date(),
): number {
  return Math.max(
    0,
    attemptDeadline(startedAt, durationMin).getTime() - now.getTime(),
  );
}

type AttemptToFinalize = {
  id: string;
  examId: string;
  startedAt: Date;
};

type GradedAttempt = {
  id: string;
  examId: string;
  userId: string;
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
};

/**
 * Grades every stored answer against its question and writes the final score.
 * Runs in a transaction so answer correctness and the attempt score are
 * persisted atomically. `submittedAt` lets callers stamp an auto-submitted
 * attempt with the exact deadline rather than "now".
 */
export async function finalizeAttempt(
  attempt: AttemptToFinalize,
  opts: { submittedAt: Date },
): Promise<GradedAttempt> {
  return prisma.$transaction(async (tx) => {
    // Take a row lock on the attempt for the duration of the transaction. A
    // concurrent answer write locks the same row before it writes, so grading
    // and answer edits can never interleave (see routes/attempts.ts).
    await tx.$queryRaw`SELECT id FROM "Attempt" WHERE id = ${attempt.id} FOR UPDATE`;

    const [questions, answers] = await Promise.all([
      tx.question.findMany({
        where: { examId: attempt.examId },
        select: { id: true, correctAnswer: true, points: true },
      }),
      tx.answer.findMany({ where: { attemptId: attempt.id } }),
    ]);

    const byQuestion = new Map(questions.map((q) => [q.id, q]));

    // Grade every answer in memory first, bucketing ids by correctness and
    // accumulating the score. An answer whose question is missing counts as
    // incorrect.
    const correctIds: string[] = [];
    const incorrectIds: string[] = [];
    let score = 0;
    for (const answer of answers) {
      const question = byQuestion.get(answer.questionId);
      const isCorrect = question
        ? answer.value === question.correctAnswer
        : false;
      if (isCorrect && question) {
        score += question.points;
        correctIds.push(answer.id);
      } else {
        incorrectIds.push(answer.id);
      }
    }

    // Collapse the per-answer writes into at most two set-based updates instead
    // of one round-trip per answer. Run sequentially: Prisma interactive
    // transactions share a single connection and don't support concurrent
    // queries on the same `tx` client.
    if (correctIds.length > 0) {
      await tx.answer.updateMany({
        where: { id: { in: correctIds } },
        data: { isCorrect: true },
      });
    }
    if (incorrectIds.length > 0) {
      await tx.answer.updateMany({
        where: { id: { in: incorrectIds } },
        data: { isCorrect: false },
      });
    }

    return tx.attempt.update({
      where: { id: attempt.id },
      data: { submittedAt: opts.submittedAt, score },
    });
  });
}

type PresentableAttempt = {
  id: string;
  examId: string;
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
};

type PresentableAnswer = {
  questionId: string;
  value: string;
  isCorrect: boolean | null;
};

/**
 * Shapes an attempt for the student response. While the attempt is in progress
 * we expose the deadline and remaining time but withhold per-answer
 * correctness; once submitted we reveal `score` and `isCorrect` (but never the
 * correct answer text itself).
 */
export function presentAttempt(
  attempt: PresentableAttempt,
  durationMin: number,
  answers: PresentableAnswer[],
) {
  const submitted = attempt.submittedAt !== null;

  return {
    id: attempt.id,
    examId: attempt.examId,
    startedAt: attempt.startedAt,
    deadline: attemptDeadline(attempt.startedAt, durationMin),
    submittedAt: attempt.submittedAt,
    score: submitted ? attempt.score : null,
    remainingMs: submitted ? 0 : remainingMs(attempt.startedAt, durationMin),
    answers: answers.map((a) => ({
      questionId: a.questionId,
      value: a.value,
      ...(submitted ? { isCorrect: a.isCorrect } : {}),
    })),
  };
}

type ResultAttempt = {
  id: string;
  examId: string;
  submittedAt: Date | null;
  score: number | null;
};

type ResultQuestion = {
  id: string;
  points: number;
};

/**
 * Processes a submitted attempt into a student-facing result: the persisted
 * `score`, the achievable `maxScore` (sum of question points), a `percentage`,
 * and a per-question breakdown of points awarded. Unanswered questions appear
 * with `awardedPoints: 0` and `isCorrect: null`. The correct answer text is
 * never included, consistent with the rest of the student-facing API.
 */
export function buildAttemptResult(
  attempt: ResultAttempt,
  questions: ResultQuestion[],
  answers: PresentableAnswer[],
) {
  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));

  const maxScore = questions.reduce((sum, q) => sum + q.points, 0);
  let correctCount = 0;

  const breakdown = questions.map((q) => {
    const answer = answerByQuestion.get(q.id);
    const isCorrect = answer?.isCorrect ?? null;
    if (isCorrect === true) correctCount += 1;

    return {
      questionId: q.id,
      points: q.points,
      awardedPoints: isCorrect === true ? q.points : 0,
      answered: answer !== undefined,
      value: answer?.value ?? null,
      isCorrect,
    };
  });

  const score = attempt.score ?? 0;
  const percentage =
    maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;

  return {
    attemptId: attempt.id,
    examId: attempt.examId,
    submittedAt: attempt.submittedAt,
    score,
    maxScore,
    percentage,
    totalQuestions: questions.length,
    correctCount,
    breakdown,
  };
}

/**
 * Validates a submitted answer value against its question's type:
 *  - true_false: must be exactly "true" or "false"
 *  - mcq: must be one of the stored options
 */
export function isValidAnswerValue(
  question: { type: "mcq" | "true_false"; options: unknown },
  value: string,
): boolean {
  if (question.type === "true_false") {
    return value === "true" || value === "false";
  }
  const options = Array.isArray(question.options)
    ? (question.options as unknown[])
    : [];
  return options.includes(value);
}
