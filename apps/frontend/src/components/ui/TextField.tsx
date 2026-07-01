import { useId, useState, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  /** Field-level error message; sets aria-invalid and is announced. */
  error?: string;
  /**
   * Show a button that toggles password visibility. Defaults to `true` for
   * `type="password"` fields and `false` otherwise.
   */
  revealable?: boolean;
};

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12S5.5 5.5 12 5.5 21.5 12 21.5 12 18.5 18.5 12 18.5 2.5 12 2.5 12Z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.6 6.1A8.7 8.7 0 0 1 12 6c6.5 0 9.5 6 9.5 6a16 16 0 0 1-2.6 3.4M6.1 7.6A16 16 0 0 0 2.5 12S5.5 18 12 18a8.7 8.7 0 0 0 3.4-.7"
      />
    </svg>
  );
}

export function TextField({
  label,
  hint,
  error,
  id,
  type,
  className,
  revealable,
  "aria-describedby": describedByProp,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  const isPassword = type === "password";
  const canReveal = revealable ?? isPassword;
  const [revealed, setRevealed] = useState(false);
  const inputType = canReveal && isPassword && revealed ? "text" : type;

  const describedBy =
    [describedByProp, hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={inputType}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm transition placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
            canReveal && isPassword && "pr-11",
            error && "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-500/40",
            className,
          )}
          {...props}
        />
        {canReveal && isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((prev) => !prev)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 text-slate-500 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {revealed ? <EyeIcon /> : <EyeOffIcon />}
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
