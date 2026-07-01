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

  const { remainingMs } = useCountdown(
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

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/dashboard" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Back to dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{exam.title}</h1>
          <Button size="sm" onClick={handleManualSubmit} disabled={locked || submitting}>
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </div>
        {exam.description && (
          <p className="mt-2 text-slate-600 dark:text-slate-400">{exam.description}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/50">
        <p className="text-slate-600 dark:text-slate-400" aria-live="polite">
          {answeredCount}/{questions.length} attempted
          {locked && " · Submitted"}
        </p>
        <div
          role="timer"
          aria-live="off"
          aria-label="Time remaining"
          className="font-mono font-semibold tabular-nums text-red-700 dark:text-red-300"
        >
          {formatCountdown(remainingMs)}
        </div>
      </div>

      <div className="pb-24">
        <Card className="p-6">
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
          onPrevious={() => setQuestionIndex((i) => i - 1)}
          onNext={() => setQuestionIndex((i) => i + 1)}
        />
      </div>
    </section>
  );
}

function ExamFooter({
  questionIndex,
  totalQuestions,
  locked,
  onPrevious,
  onNext,
}: {
  questionIndex: number;
  totalQuestions: number;
  locked: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-20 px-4 pb-4 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Card className="flex items-center justify-between gap-3 bg-white/40 px-6 py-3.5 backdrop-blur-xl backdrop-saturate-150 dark:bg-slate-900/40">
          <Button
            variant="secondary"
            size="sm"
            disabled={questionIndex === 0 || locked}
            onClick={onPrevious}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={questionIndex >= totalQuestions - 1 || locked}
            onClick={onNext}
          >
            Next
          </Button>
        </Card>
      </div>
    </footer>
  );
}
