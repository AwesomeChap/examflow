import { useEffect, useId, useRef, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type TextAreaVariant = "default" | "plain";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  /** Visual-only label prefix (e.g. "#3"); excluded from the accessible name. */
  prefix?: ReactNode;
  /** Grow height with content (1 line by default). Default true. */
  autoGrow?: boolean;
  /** `plain` = borderless inline field (e.g. Medium-style exam description). */
  variant?: TextAreaVariant;
  /** Visually hide the label while keeping it accessible. */
  hideLabel?: boolean;
};

const VARIANT_STYLES: Record<TextAreaVariant, string> = {
  default:
    "rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-950",
  plain: "border-0 bg-transparent p-0 shadow-none focus-visible:outline-none focus-visible:ring-0",
};

export function TextArea({
  label,
  hint,
  prefix,
  autoGrow = true,
  variant = "default",
  hideLabel = false,
  id,
  className,
  rows,
  value,
  onChange,
  ...props
}: TextAreaProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!autoGrow) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [autoGrow, value]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("flex items-center gap-2", hideLabel && "sr-only")}>
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
        ref={textareaRef}
        id={fieldId}
        rows={rows ?? (autoGrow ? 1 : 3)}
        value={value}
        onChange={onChange}
        aria-describedby={hintId}
        className={cn(
          "w-full text-slate-900 transition placeholder:text-slate-400 dark:text-slate-100",
          autoGrow && "resize-none overflow-hidden",
          VARIANT_STYLES[variant],
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
