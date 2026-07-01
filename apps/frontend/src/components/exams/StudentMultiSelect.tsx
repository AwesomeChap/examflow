import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import type { Student } from "@examflow/shared-types";

type StudentMultiSelectProps = {
  students: Student[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
};

function summarize(selectedCount: number, total: number): string {
  if (total === 0) return "No students available";
  if (selectedCount === 0) return "No students assigned";
  if (selectedCount === total) return `All students (${total})`;
  return `${selectedCount} of ${total} students`;
}

export function StudentMultiSelect({
  students,
  selectedIds,
  onChange,
  isLoading,
  disabled,
}: StudentMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        // Return focus to the trigger so keyboard users are not stranded.
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Move focus into the popup's search field when it opens.
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const selected = new Set(selectedIds);
  const allSelected = students.length > 0 && selected.size === students.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    onChange(allSelected ? [] : students.map((s) => s.id));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const filtered = query
    ? students.filter((s) =>
        `${s.name} ${s.email} ${s.matriculationNumber ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : students;

  return (
    <div ref={containerRef} className="relative">
      <span
        id="target-students-label"
        className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
      >
        Target students
      </span>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby="target-students-label"
        className={cn(
          "flex w-full min-w-56 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm transition hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200",
        )}
      >
        <span className="truncate">
          {isLoading ? "Loading students…" : summarize(selected.size, students.length)}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 shrink-0 text-slate-400"
          aria-hidden="true"
        >
          <path
            d="M5.5 7.5 10 12l4.5-4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Select target students"
          className="absolute z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students…"
            aria-label="Search students"
            className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-950"
          />

          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={toggleAll}
            />
            Select all
          </label>

          <div className="mt-1 max-h-60 overflow-auto" role="group" aria-label="Students">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-sm text-slate-400">No matches.</p>
            ) : (
              filtered.map((student) => (
                <label
                  key={student.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0"
                    checked={selected.has(student.id)}
                    onChange={() => toggleOne(student.id)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-slate-800 dark:text-slate-100">
                      {student.name}
                    </span>
                    <span className="block truncate text-xs text-slate-400">
                      {student.matriculationNumber ?? student.email}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
