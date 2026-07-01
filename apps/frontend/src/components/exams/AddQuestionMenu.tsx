import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { QuestionType } from "../../types/question";

type AddQuestionMenuProps = {
  onSelect: (type: QuestionType) => void;
  disabled?: boolean;
};

const ITEMS: { type: QuestionType; label: string }[] = [
  { type: "mcq", label: "Multiple choice" },
  { type: "true_false", label: "True / False" },
];

/** Medium-style round "+" button that reveals the two question types. */
export function AddQuestionMenu({ onSelect, disabled }: AddQuestionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // When opened via keyboard we focus an item; pointer opens leave focus alone.
  const focusOnOpen = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Move focus into the menu when it was opened from the keyboard.
  useEffect(() => {
    if (!open || focusOnOpen.current === null) return;
    itemRefs.current[focusOnOpen.current]?.focus();
    focusOnOpen.current = null;
  }, [open]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const choose = (type: QuestionType) => {
    setOpen(false);
    triggerRef.current?.focus();
    onSelect(type);
  };

  const openMenu = (focusIndex: number | null) => {
    focusOnOpen.current = focusIndex;
    setOpen(true);
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openMenu(ITEMS.length - 1);
    }
  };

  const onItemKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        itemRefs.current[(index + 1) % ITEMS.length]?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        itemRefs.current[(index - 1 + ITEMS.length) % ITEMS.length]?.focus();
        break;
      case "Home":
        e.preventDefault();
        itemRefs.current[0]?.focus();
        break;
      case "End":
        e.preventDefault();
        itemRefs.current[ITEMS.length - 1]?.focus();
        break;
      case "Escape":
        e.preventDefault();
        close(true);
        break;
      case "Tab":
        // Tabbing away from the menu dismisses it (native focus move continues).
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={ref} className="relative flex items-center gap-3">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close(false) : openMenu(null))}
        onKeyDown={onTriggerKeyDown}
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
          {ITEMS.map((item, index) => (
            <button
              key={item.type}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              role="menuitem"
              onClick={() => choose(item.type)}
              onKeyDown={(e) => onItemKeyDown(e, index)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
