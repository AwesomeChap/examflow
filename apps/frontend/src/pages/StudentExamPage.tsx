import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ExamQuestionPanel } from "../components/exams/ExamQuestionPanel";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useCountdown } from "../hooks/useCountdown";
import { useToast } from "../hooks/useToast";
import { formatCountdown } from "../lib/formatTime";
import {
  useGetStudentExamQuery,
  useSaveAnswerMutation,
  useStartAttemptMutation,
  useSubmitAttemptMutation,
  type StudentExamDetail,
} from "../store/attemptsApi";
import type { Attempt } from "@examflow/shared-types";

export function StudentExamPage() {
  const { examId = "" } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  const {
    data: exam,
    isLoading: loadingExam,
    isError: examError,
  } = useGetStudentExamQuery(examId, {
    skip: !examId,
  });

  const [startAttempt, { isLoading: starting }] = useStartAttemptMutation();
  const [saveAnswer] = useSaveAnswerMutation();
  const [submitAttempt, { isLoading: submitting }] = useSubmitAttemptMutation();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [locked, setLocked] = useState(false);
  const startedRef = useRef(false);
  const submitInFlight = useRef(false);

  const questions = useMemo(
    () => (exam ? [...exam.questions].sort((a, b) => a.order - b.order) : []),
    [exam],
  );

  const answerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of attempt?.answers ?? []) map.set(a.questionId, a.value);
    return map;
  }, [attempt?.answers]);

  const answeredCount = useMemo(() => {
    const ids = new Set(questions.map((q) => q.id));
    let count = 0;
    for (const [qid] of answerMap) if (ids.has(qid)) count += 1;
    return count;
  }, [answerMap, questions]);

  const finishExam = useCallback(
    async (reason: "manual" | "timer") => {
      if (!examId || submitInFlight.current || locked) return;
      submitInFlight.current = true;
      setLocked(true);
      try {
        const result = await submitAttempt(examId).unwrap();
        setAttempt(result);
        notify({
          message: reason === "timer" ? "Time's up — exam submitted." : "Exam submitted.",
          variant: "success",
        });
        navigate(`/results/${examId}/${result.id}`, { replace: true });
      } catch {
        setLocked(false);
        submitInFlight.current = false;
        notify({ message: "Could not submit the exam.", variant: "error" });
      }
    },
    [examId, locked, navigate, notify, submitAttempt],
  );

  const { remainingMs, expired } = useCountdown(
    attempt && !attempt.submittedAt ? attempt.deadline : null,
    () => void finishExam("timer"),
  );

  // Start or resume the attempt once the exam is loaded.
  useEffect(() => {
    if (!examId || !exam || startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      try {
        const att = await startAttempt(examId).unwrap();
        if (att.submittedAt) {
          navigate(`/results/${examId}/${att.id}`, { replace: true });
          return;
        }
        setAttempt(att);
      } catch (err) {
        const status = (err as { status?: number })?.status;
        setStartError(
          status === 409
            ? "You have used all your attempts for this exam."
            : "Could not start this exam. It may not be open yet.",
        );
      }
    })();
  }, [exam, examId, navigate, startAttempt]);

  const current = questions[questionIndex];

  const selectAnswer = (value: string) => {
    if (!examId || !current || locked || !attempt) return;
    setAttempt((prev) => {
      if (!prev) return prev;
      const answers = [...prev.answers];
      const idx = answers.findIndex((a) => a.questionId === current.id);
      if (idx >= 0) answers[idx] = { questionId: current.id, value };
      else answers.push({ questionId: current.id, value });
      return { ...prev, answers };
    });
    void saveAnswer({ examId, questionId: current.id, value });
  };

  const handleManualSubmit = () => {
    if (locked) return;
    if (!window.confirm("Submit your exam now? You won't be able to change your answers.")) return;
    void finishExam("manual");
  };

  if (loadingExam || starting || (!attempt && !startError)) {
    return (
      <p role="status" className="text-slate-500 dark:text-slate-400">
        Loading exam…
      </p>
    );
  }

  if (examError || !exam) {
    return (
      <p role="alert" className="text-red-600 dark:text-red-400">
        This exam is not available to you.
      </p>
    );
  }

  if (startError) {
    return (
      <section className="space-y-4">
        <p role="alert" className="text-red-600 dark:text-red-400">
          {startError}
        </p>
        <Link to="/dashboard" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Back to dashboard
        </Link>
      </section>
    );
  }

  if (!attempt || !current) {
    return (
      <p role="alert" className="text-red-600 dark:text-red-400">
        This exam has no questions.
      </p>
    );
  }

  const timerUrgent = remainingMs <= 5 * 60 * 1000 && !expired;

  return (
    // Bottom padding clears the fixed footer bar so the card never hides behind it.
    <div className="mx-auto max-w-3xl pb-28">
      <ExamHeader
        exam={exam}
        remainingMs={remainingMs}
        timerUrgent={timerUrgent}
        answeredCount={answeredCount}
        totalQuestions={questions.length}
        locked={locked}
      />

      <Card className="mt-6 p-6">
        <ExamQuestionPanel
          question={current}
          index={questionIndex}
          total={questions.length}
          value={answerMap.get(current.id)}
          disabled={locked}
          onChange={selectAnswer}
        />
      </Card>

      <ExamFooter
        questionIndex={questionIndex}
        totalQuestions={questions.length}
        locked={locked}
        submitting={submitting}
        onPrevious={() => setQuestionIndex((i) => i - 1)}
        onNext={() => setQuestionIndex((i) => i + 1)}
        onSubmit={handleManualSubmit}
      />
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12.5 5 7.5 10l5 5" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 5l5 5-5 5" />
    </svg>
  );
}

/**
 * Fixed action bar pinned to the bottom of the viewport (mirroring the sticky
 * header). Keeping Previous/Next in a constant position stops them jumping as
 * question length changes, and isolating Submit on the far right — where the
 * timer sits above — guards against accidental submits. The inner column widths
 * match the page content so the controls line up with the question card edges.
 */
function ExamFooter({
  questionIndex,
  totalQuestions,
  locked,
  submitting,
  onPrevious,
  onNext,
  onSubmit,
}: {
  questionIndex: number;
  totalQuestions: number;
  locked: boolean;
  submitting: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-3 py-3.5">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={questionIndex === 0 || locked}
                onClick={onPrevious}
              >
                <ChevronLeftIcon />
                Previous
              </Button>
              <span
                aria-hidden="true"
                className="h-5 w-px bg-slate-200 dark:bg-slate-700"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={questionIndex >= totalQuestions - 1 || locked}
                onClick={onNext}
              >
                Next
                <ChevronRightIcon />
              </Button>
            </div>
            <Button onClick={onSubmit} disabled={locked || submitting}>
              {submitting ? "Submitting…" : "Submit exam"}
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}

function ExamHeader({
  exam,
  remainingMs,
  timerUrgent,
  answeredCount,
  totalQuestions,
  locked,
}: {
  exam: StudentExamDetail;
  remainingMs: number;
  timerUrgent: boolean;
  answeredCount: number;
  totalQuestions: number;
  locked: boolean;
}) {
  return (
    // Styled to match the question card (same width, rounded border, shadow) so
    // it reads as part of the same stack instead of a wider bar bleeding past it.
    <header className="sticky top-0 z-10 rounded-2xl border border-slate-200 bg-white/95 px-6 py-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {exam.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
            {answeredCount}/{totalQuestions} attempted
            {locked && " · Submitted"}
          </p>
        </div>
        <div
          role="timer"
          aria-live="off"
          aria-label="Time remaining"
          className={[
            "rounded-lg px-4 py-2 font-mono text-lg font-semibold tabular-nums",
            timerUrgent
              ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
              : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
          ].join(" ")}
        >
          {formatCountdown(remainingMs)}
        </div>
      </div>
    </header>
  );
}
