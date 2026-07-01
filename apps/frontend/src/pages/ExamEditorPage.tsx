import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AddQuestionMenu } from "../components/exams/AddQuestionMenu";
import { QuestionForm } from "../components/exams/QuestionForm";
import { QuestionList } from "../components/exams/QuestionList";
import { StudentMultiSelect } from "../components/exams/StudentMultiSelect";
import { Button } from "../components/ui/Button";
import { ButtonLink } from "../components/ui/ButtonLink";
import { TextArea } from "../components/ui/TextArea";
import { useCloneExam } from "../hooks/useCloneExam";
import { useToast } from "../hooks/useToast";
import { isExamEditable, lockReason } from "../lib/examRules";
import {
  useAssignStudentsMutation,
  useGetExamStudentsQuery,
  useUnassignStudentMutation,
} from "../store/assignmentsApi";
import {
  useDeleteExamMutation,
  useGetExamQuery,
  useUpdateExamMutation,
  type UpdateExamBody,
} from "../store/examsApi";
import type { QuestionBody } from "../store/questionsApi";
import {
  useCreateQuestionMutation,
  useDeleteQuestionMutation,
  useGetExamQuestionsQuery,
  useReorderQuestionsMutation,
  useUpdateQuestionMutation,
} from "../store/questionsApi";
import { useGetStudentsQuery } from "../store/studentsApi";
import type { Question, QuestionType } from "../types/question";

type SaveState = "idle" | "saving" | "saved" | "error";

type Mode =
  | { kind: "idle" }
  | { kind: "add"; type: QuestionType }
  | { kind: "edit"; question: Question };

/** ISO string -> value for <input type="datetime-local"> (local time). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ExamEditorPage() {
  const { examId = "" } = useParams();
  const navigate = useNavigate();

  const { data: exam, isLoading, isError } = useGetExamQuery(examId, { skip: !examId });
  const { data: questions = [], isLoading: loadingQuestions } = useGetExamQuestionsQuery(examId, {
    skip: !examId,
  });
  const { data: allStudents = [], isLoading: loadingStudents } = useGetStudentsQuery();
  const { data: assignedIds = [] } = useGetExamStudentsQuery(examId, { skip: !examId });

  const [updateExam] = useUpdateExamMutation();
  const [deleteExam, { isLoading: discarding }] = useDeleteExamMutation();
  const [createQuestion, { isLoading: creating }] = useCreateQuestionMutation();
  const [updateQuestion, { isLoading: updatingQuestion }] = useUpdateQuestionMutation();
  const [deleteQuestion] = useDeleteQuestionMutation();
  const [reorderQuestions] = useReorderQuestionsMutation();
  const [assignStudents] = useAssignStudentsMutation();
  const [unassignStudent] = useUnassignStudentMutation();
  const { clone, cloningId } = useCloneExam();
  const { notify } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMin, setDurationMin] = useState(60);
  const [startsAt, setStartsAt] = useState("");
  const [maxAttempts, setMaxAttempts] = useState<number>(1);
  const [unlimitedAttempts, setUnlimitedAttempts] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [deletingId, setDeletingId] = useState<string>();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (exam) {
      setTitle(exam.title);
      setDescription(exam.description ?? "");
      setDurationMin(exam.durationMin);
      setStartsAt(toLocalInput(exam.startsAt));
      setUnlimitedAttempts(exam.maxAttempts === null);
      setMaxAttempts(exam.maxAttempts ?? 1);
    }
  }, [exam]);

  useEffect(() => {
    setSelected(assignedIds);
  }, [assignedIds]);

  const editable = useMemo(() => (exam ? isExamEditable(exam) : true), [exam]);

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
        <Link to="/dashboard" className="mt-3 inline-block text-blue-600 dark:text-blue-400">
          Back to dashboard
        </Link>
      </div>
    );
  }

  // Locked exams (started or with results) are read-only; offer clone instead.
  if (!editable) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-500/40 dark:bg-amber-500/10">
        <h1 className="text-lg font-semibold">{exam.title}</h1>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">{lockReason(exam)}</p>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => clone(exam.id)} disabled={cloningId === exam.id}>
            {cloningId === exam.id ? "Cloning…" : "Clone exam"}
          </Button>
          <ButtonLink to={`/exam/${exam.id}/details`} variant="secondary">
            View analytics
          </ButtonLink>
        </div>
      </div>
    );
  }

  const persist = async (body: UpdateExamBody) => {
    setSaveState("saving");
    try {
      await updateExam({ id: exam.id, body }).unwrap();
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const persistAttempts = (unlimited: boolean, value: number) => {
    void persist({ maxAttempts: unlimited ? null : Math.max(1, value) });
  };

  // "Opens at" must never be in the past — an elapsed start time would mean the
  // exam is already open. Reject past values (revert to the stored one) instead
  // of persisting them.
  const commitStartsAt = () => {
    if (!startsAt) {
      void persist({ startsAt: null });
      return;
    }
    const chosen = new Date(startsAt);
    if (chosen.getTime() < Date.now()) {
      notify({ message: "Open time can't be in the past.", variant: "error" });
      setStartsAt(toLocalInput(exam.startsAt));
      return;
    }
    void persist({ startsAt: chosen.toISOString() });
  };

  const handleStudentsChange = async (next: string[]) => {
    const added = next.filter((id) => !selected.includes(id));
    const removed = selected.filter((id) => !next.includes(id));
    setSelected(next);
    try {
      if (added.length > 0) await assignStudents({ examId: exam.id, studentIds: added }).unwrap();
      for (const id of removed) await unassignStudent({ examId: exam.id, studentId: id }).unwrap();
    } catch {
      setActionError("Could not update target students.");
    }
  };

  const submitQuestion = async (body: QuestionBody) => {
    setActionError(null);
    try {
      if (mode.kind === "edit") {
        await updateQuestion({ examId: exam.id, questionId: mode.question.id, body }).unwrap();
      } else {
        await createQuestion({ examId: exam.id, body }).unwrap();
      }
      setMode({ kind: "idle" });
    } catch {
      setActionError("Could not save the question.");
    }
  };

  const handleReorder = (orderedIds: string[]) => {
    setActionError(null);
    void reorderQuestions({ examId: exam.id, orderedIds });
  };

  const removeQuestion = async (question: Question) => {
    setActionError(null);
    setDeletingId(question.id);
    try {
      await deleteQuestion({ examId: exam.id, questionId: question.id }).unwrap();
    } catch {
      setActionError("Could not delete the question.");
    } finally {
      setDeletingId(undefined);
    }
  };

  const publish = async () => {
    await persist({ status: "published" });
    notify({ message: "Exam published.", variant: "success" });
    navigate(`/exam/${exam.id}/details`);
  };

  const discard = async () => {
    setActionError(null);
    try {
      await deleteExam(exam.id).unwrap();
      notify({ message: "Draft discarded.", variant: "info" });
      navigate("/dashboard", { replace: true });
    } catch {
      setActionError("Could not discard the draft.");
    }
  };

  const canPublish = questions.length > 0;
  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "All changes saved"
        : saveState === "error"
          ? "Couldn’t save"
          : "";

  return (
    <div className="pb-16">
      {/* Top bar */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {exam.status === "published" ? "Published" : "Draft"}
          </span>
          <span aria-live="polite" className="text-sm text-slate-400">
            {saveLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {exam.status === "draft" && (
            <Button variant="ghost" onClick={discard} disabled={discarding}>
              Discard
            </Button>
          )}
          {exam.status === "published" ? (
            <Button variant="secondary" onClick={() => persist({ status: "draft" })}>
              Unpublish
            </Button>
          ) : (
            <Button onClick={publish} disabled={!canPublish} title={canPublish ? undefined : "Add a question first"}>
              Publish
            </Button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        {actionError && (
          <p role="alert" className="mb-4 text-sm font-medium text-red-600 dark:text-red-400">
            {actionError}
          </p>
        )}

        {/* Metadata above the title */}
        <div className="mb-8 flex flex-wrap items-end gap-x-6 gap-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <div>
            <label htmlFor="duration" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Duration (minutes)
            </label>
            <input
              id="duration"
              type="number"
              min={1}
              max={1440}
              value={durationMin}
              onChange={(e) => setDurationMin(Math.max(1, Number(e.target.value) || 1))}
              onBlur={() => persist({ durationMin })}
              className="h-10 w-28 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div>
            <label htmlFor="startsAt" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Opens at (optional)
            </label>
            <input
              id="startsAt"
              type="datetime-local"
              value={startsAt}
              min={toLocalInput(new Date().toISOString())}
              onChange={(e) => setStartsAt(e.target.value)}
              onBlur={commitStartsAt}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:[color-scheme:dark]"
            />
          </div>
          <div>
            <label htmlFor="maxAttempts" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Attempts allowed
            </label>
            <div className="flex items-center gap-3">
              <input
                id="maxAttempts"
                type="number"
                min={1}
                max={100}
                value={unlimitedAttempts ? "" : maxAttempts}
                disabled={unlimitedAttempts}
                onChange={(e) => setMaxAttempts(Math.max(1, Number(e.target.value) || 1))}
                onBlur={() => persistAttempts(false, maxAttempts)}
                placeholder="∞"
                className="h-10 w-24 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900"
              />
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={unlimitedAttempts}
                  onChange={(e) => {
                    const unlimited = e.target.checked;
                    setUnlimitedAttempts(unlimited);
                    persistAttempts(unlimited, maxAttempts);
                  }}
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600 dark:border-slate-700"
                />
                Unlimited
              </label>
            </div>
          </div>
          <div>
            <StudentMultiSelect
              students={allStudents}
              selectedIds={selected}
              onChange={handleStudentsChange}
              isLoading={loadingStudents}
            />
          </div>
        </div>

        {/* Title */}
        <label htmlFor="exam-title" className="sr-only">
          Exam title
        </label>
        <input
          id="exam-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && persist({ title: title.trim() })}
          placeholder="Title"
          className="w-full border-0 bg-transparent p-0 font-sans text-4xl font-bold tracking-tight text-slate-900 placeholder:text-slate-300 focus:outline-none dark:text-slate-50 dark:placeholder:text-slate-700"
        />

        {/* Description */}
        <TextArea
          label="Exam description"
          hideLabel
          variant="plain"
          id="exam-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => persist({ description: description.trim() || null })}
          placeholder="Add a description…"
          className="mt-2 text-lg text-slate-600 placeholder:text-slate-300 dark:text-slate-300 dark:placeholder:text-slate-700"
        />

        {/* Questions */}
        <div className="mt-6">
          {questions.length > 0 && (
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Questions ({questions.length})
            </h2>
          )}

          {!loadingQuestions && (
            <QuestionList
              questions={questions}
              onEdit={(question) => setMode({ kind: "edit", question })}
              onDelete={removeQuestion}
              onReorder={handleReorder}
              deletingId={deletingId}
              editingId={mode.kind === "edit" ? mode.question.id : undefined}
              renderEditForm={(question, index) => (
                <QuestionForm
                  initial={question}
                  number={index + 1}
                  submitting={updatingQuestion}
                  onSubmit={submitQuestion}
                  onCancel={() => setMode({ kind: "idle" })}
                />
              )}
            />
          )}

          {mode.kind === "add" && (
            <div className="mt-4 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
              <QuestionForm
                initialType={mode.type}
                number={questions.length + 1}
                submitting={creating}
                onSubmit={submitQuestion}
                onCancel={() => setMode({ kind: "idle" })}
              />
            </div>
          )}

          {mode.kind === "idle" && (
            <div className={questions.length > 0 ? "mt-4" : ""}>
              <AddQuestionMenu onSelect={(type) => setMode({ kind: "add", type })} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
