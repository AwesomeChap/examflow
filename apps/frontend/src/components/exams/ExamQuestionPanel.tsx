import type { StudentQuestion } from "../../types/studentQuestion";

type ExamQuestionPanelProps = {
  question: StudentQuestion;
  index: number;
  total: number;
  value: string | undefined;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function ExamQuestionPanel({
  question,
  index,
  total,
  value,
  disabled,
  onChange,
}: ExamQuestionPanelProps) {
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

      {question.type === "mcq" && question.options ? (
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="sr-only">Choose an answer</legend>
          {question.options.map((option) => {
            const selected = value === option;
            return (
              <label
                key={option}
                className={[
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition",
                  selected
                    ? "border-blue-400 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10"
                    : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900",
                  disabled && "pointer-events-none opacity-60",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  checked={selected}
                  onChange={() => onChange(option)}
                  className="h-4 w-4 accent-blue-600"
                />
                <span className="text-slate-900 dark:text-slate-100">{option}</span>
              </label>
            );
          })}
        </fieldset>
      ) : (
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Your answer
          </legend>
          {(["true", "false"] as const).map((option) => {
            const selected = value === option;
            return (
              <label
                key={option}
                className={[
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 capitalize transition",
                  selected
                    ? "border-blue-400 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10"
                    : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900",
                  disabled && "pointer-events-none opacity-60",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  checked={selected}
                  onChange={() => onChange(option)}
                  className="h-4 w-4 accent-blue-600"
                />
                <span className="text-slate-900 dark:text-slate-100">{option}</span>
              </label>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}
