import type { StudentQuestion } from "@examflow/shared-types";
import { formatAnswerDisplay } from "../../lib/formatAnswer";

type ExamQuestionPanelProps = {
  question: StudentQuestion;
  index: number;
  total: number;
  value?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  /**
   * Read-only preview: the correct answer to highlight (green). When set, the
   * panel renders non-interactively — used for the staff exam preview where
   * there is no attempt to submit.
   */
  correctValue?: string;
};

export function ExamQuestionPanel({
  question,
  index,
  total,
  value,
  disabled,
  onChange,
  correctValue,
}: ExamQuestionPanelProps) {
  const preview = correctValue !== undefined;
  const readOnly = disabled || preview;
  const options =
    question.type === "mcq" && question.options ? question.options : ["true", "false"];
  const isTrueFalse = question.type !== "mcq";

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-sm font-semibold text-slate-400">
          Question {index + 1} of {total}
        </p>
        <p className="text-lg font-medium text-slate-900 dark:text-slate-100">{question.text}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {question.points} point{question.points === 1 ? "" : "s"}
        </p>
      </div>

      <fieldset className="space-y-2" disabled={readOnly}>
        <legend
          className={
            preview ? "mb-1 text-sm font-medium text-slate-700 dark:text-slate-200" : "sr-only"
          }
        >
          {preview ? "Answer options" : "Choose an answer"}
        </legend>
        {options.map((option) => {
          const selected = value === option;
          const isCorrect = preview && correctValue === option;
          return (
            <label
              key={option}
              className={[
                "flex items-center gap-3 rounded-lg border px-4 py-3 transition",
                isTrueFalse && "capitalize",
                isCorrect
                  ? "border-green-400 bg-green-50 dark:border-green-500/40 dark:bg-green-500/10"
                  : selected
                    ? "border-blue-400 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10"
                    : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950",
                readOnly
                  ? "cursor-default"
                  : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900",
                disabled && "opacity-60",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                checked={preview ? isCorrect : selected}
                onChange={() => onChange?.(option)}
                className={isCorrect ? "h-4 w-4 accent-green-600" : "h-4 w-4 accent-blue-600"}
              />
              <span className="text-slate-900 dark:text-slate-100">
                {formatAnswerDisplay(option)}
              </span>
              {isCorrect && (
                <span className="ml-auto text-xs font-semibold text-green-700 dark:text-green-400">
                  Correct answer
                </span>
              )}
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}
