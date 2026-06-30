import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type BadgeTone = "neutral" | "success" | "warning" | "info";

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  success: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
