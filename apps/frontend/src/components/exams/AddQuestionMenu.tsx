import { useEffect, useRef, useState } from "react";
import type { QuestionType } from "../../types/question";

type AddQuestionMenuProps = {
  onSelect: (type: QuestionType) => void;
  disabled?: boolean;
};

/** Medium-style round "+" button that reveals the two question types. */
export function AddQuestionMenu({ onSelect, disabled }: AddQuestionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (type: QuestionType) => {
    setOpen(false);
    onSelect(type);
  };

  return (
    <div ref={ref} className="relative flex items-center gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Add a question"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition hover:border-slate-900 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:border-slate-600 dark:hover:border-slate-100 dark:hover:text-slate-100"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <path strokeLinecap="round" d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Question type"
          className="absolute left-0 top-11 z-20 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => choose("mcq")}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Multiple choice
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => choose("true_false")}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            True / False
          </button>
        </div>
      )}
    </div>
  );
}
