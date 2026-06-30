import { useRef, type KeyboardEvent } from "react";
import { cn } from "../../lib/cn";

export type SegmentOption<T extends string> = {
  id: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  /** Accessible name for the group (e.g. "Sign in as"). */
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (id: T) => void;
};

/**
 * Single-select segmented control. Implemented as a WAI-ARIA radio group with
 * roving tabindex and arrow/Home/End keyboard support, so it is fully operable
 * by keyboard and announced correctly by assistive tech.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.id);
    buttons.current[index]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        select(index === last ? 0 : index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        select(index === 0 ? last : index - 1);
        break;
      case "Home":
        event.preventDefault();
        select(0);
        break;
      case "End":
        event.preventDefault();
        select(last);
        break;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
    >
      {options.map((option, index) => {
        const checked = option.id === value;
        return (
          <button
            key={option.id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
              checked
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
