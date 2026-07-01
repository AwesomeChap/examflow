import { cn } from "../../lib/cn";
import type { Toast } from "../../context/toast-context";

type ToasterProps = {
  toasts: Toast[];
  onDismiss: (id: string) => void;
};

const VARIANT_STYLES: Record<Toast["variant"], string> = {
  success:
    "border-green-200 bg-green-50 text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300",
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  info: "border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
};

const VARIANT_ICON: Record<Toast["variant"], string> = {
  success: "✓",
  error: "!",
  info: "i",
};

export function Toaster({ toasts, onDismiss }: ToasterProps) {
  return (
    // A plain region wrapper (not itself a live region) so we don't nest live
    // regions; each toast is its own live region with politeness matched to
    // its urgency (errors assertive, everything else polite).
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 top-4 z-[9999] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.variant === "error" ? "alert" : "status"}
          aria-live={toast.variant === "error" ? "assertive" : "polite"}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg",
            "motion-safe:animate-[toast-in_180ms_ease-out]",
            VARIANT_STYLES[toast.variant],
          )}
        >
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/5 text-xs font-bold dark:bg-white/10"
          >
            {VARIANT_ICON[toast.variant]}
          </span>
          <p className="min-w-0 flex-1 text-sm font-medium">{toast.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="-mr-1 shrink-0 rounded p-0.5 text-current/70 transition hover:text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40"
          >
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" d="m5 5 10 10M15 5 5 15" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
