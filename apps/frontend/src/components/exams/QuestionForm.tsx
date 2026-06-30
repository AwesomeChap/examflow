import { useEffect, useRef, useState, type FormEvent } from "react";
import type { QuestionBody } from "../../store/questionsApi";
import type { Question, QuestionType } from "../../types/question";
import { Button } from "../ui/Button";
import { SegmentedControl } from "../ui/SegmentedControl";
import { TextArea } from "../ui/TextArea";
import { TextField } from "../ui/TextField";

const MAX_OPTIONS = 10;

type QuestionFormProps = {
  /** When provided, the form edits this question; otherwise it adds a new one. */
  initial?: Question;
  /** Default type for a new question (e.g. chosen from the add menu). */
  initialType?: QuestionType;
  /** 1-based position, shown inline as a "#N" prefix on the question field. */
  number?: number;
  submitting?: boolean;
  onSubmit: (body: QuestionBody) => Promise<void> | void;
  onCancel: () => void;
};

export function QuestionForm({ initial, initialType, number, submitting, onSubmit, onCancel }: QuestionFormProps) {
  // The type is fixed when the form opens (chosen from the "+" menu, or taken
  // from the question being edited), so there's no in-form type toggle.
  const type: QuestionType = initial?.type ?? initialType ?? "mcq";
  const [text, setText] = useState(initial?.text ?? "");
  const [points, setPoints] = useState(initial?.points ?? 1);
  const [options, setOptions] = useState<string[]>(
    initial?.type === "mcq" && initial.options ? initial.options : ["", ""],
  );
  const [mcqCorrect, setMcqCorrect] = useState<number>(() => {
    if (initial?.type === "mcq" && initial.options) {
      const idx = initial.options.indexOf(initial.correctAnswer);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });
  const [tfCorrect, setTfCorrect] = useState<"true" | "false">(
    initial?.type === "true_false" && initial.correctAnswer === "false" ? "false" : "true",
  );
  const [error, setError] = useState<string | null>(null);

  const optionRefs = useRef<(HTMLInputElement | null)[]>([]);
  const focusLast = useRef(false);

  // Focus the option we just appended so the user can keep typing.
  useEffect(() => {
    if (!focusLast.current) return;
    focusLast.current = false;
    optionRefs.current[options.length - 1]?.focus();
  }, [options]);

  const setOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    focusLast.current = true;
    setOptions((prev) => [...prev, ""]);
  };

  const removeOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
    setMcqCorrect((prev) => (prev >= index && prev > 0 ? prev - 1 : prev));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedText = text.trim();
    if (!trimmedText) {
      setError("Question text is required.");
      return;
    }

    if (type === "mcq") {
      const cleaned = options.map((o) => o.trim());
      if (cleaned.some((o) => !o)) {
        setError("All options must be filled in (or removed).");
        return;
      }
      if (cleaned.length < 2) {
        setError("Add at least two options.");
        return;
      }
      const correctAnswer = cleaned[mcqCorrect];
      if (!correctAnswer) {
        setError("Select which option is correct.");
        return;
      }
      void onSubmit({ type: "mcq", text: trimmedText, options: cleaned, correctAnswer, points });
      return;
    }

    void onSubmit({ type: "true_false", text: trimmedText, correctAnswer: tfCorrect, points });
  };

  return (
    <form onSubmit={handleSubmit} aria-label={initial ? "Edit question" : "Add question"} className="space-y-5">
      <TextArea
        label="Question"
        prefix={number != null ? `#${number}` : undefined}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        required
      />

      {type === "mcq" ? (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Options{" "}
            <span className="font-normal text-slate-400">— select the radio to mark the correct answer</span>
          </legend>
          {options.map((option, index) => {
            const isCorrect = mcqCorrect === index;
            return (
              <div
                key={index}
                className={[
                  "flex items-center gap-3 rounded-lg border px-3 py-2 transition",
                  isCorrect
                    ? "border-green-400 bg-green-50/60 dark:border-green-500/40 dark:bg-green-500/10"
                    : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="mcq-correct"
                  checked={isCorrect}
                  onChange={() => setMcqCorrect(index)}
                  aria-label={`Mark option ${index + 1} as correct`}
                  className="h-4 w-4 shrink-0 accent-green-600"
                />
                <input
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  type="text"
                  value={option}
                  onChange={(e) => setOption(index, e.target.value)}
                  aria-label={`Option ${index + 1}`}
                  placeholder={`Option ${index + 1}`}
                  className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    aria-label={`Remove option ${index + 1}`}
                    className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 dark:hover:bg-slate-800"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path strokeLinecap="round" d="m5 5 10 10M15 5 5 15" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
          {options.length < MAX_OPTIONS && (
            <Button variant="ghost" size="sm" onClick={addOption}>
              + Add option
            </Button>
          )}
        </fieldset>
      ) : (
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">Correct answer</p>
          <SegmentedControl
            label="Correct answer"
            options={[
              { id: "true", label: "True" },
              { id: "false", label: "False" },
            ]}
            value={tfCorrect}
            onChange={setTfCorrect}
          />
        </div>
      )}

      <TextField
        label="Points"
        type="number"
        min={1}
        max={100}
        value={points}
        onChange={(e) => setPoints(Math.max(1, Number(e.target.value) || 1))}
        className="max-w-32"
      />

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Saving…" : initial ? "Save question" : "Add question"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
