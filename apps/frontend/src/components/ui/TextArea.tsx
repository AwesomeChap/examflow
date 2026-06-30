import { useId, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  /** Visual-only label prefix (e.g. "#3"); excluded from the accessible name. */
  prefix?: ReactNode;
};

export function TextArea({ label, hint, prefix, id, className, ...props }: TextAreaProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {prefix != null && (
          <span aria-hidden="true" className="text-sm font-semibold text-slate-400">
            {prefix}
          </span>
        )}
        <label htmlFor={fieldId} className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </label>
      </div>
      <textarea
        id={fieldId}
        aria-describedby={hintId}
        className={cn(
          "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm transition placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
          className,
        )}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}
