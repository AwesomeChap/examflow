import { cn } from "../lib/cn";

type LogoProps = {
  className?: string;
  /** Hide the wordmark (mark only) — useful in tight spaces. */
  iconOnly?: boolean;
};

export function Logo({ className, iconOnly = false }: LogoProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      role={iconOnly ? "img" : undefined}
      aria-label={iconOnly ? "ExamFlow" : undefined}
    >
      <span className="h-5 w-5 bg-blue-600" aria-hidden="true" />
      {!iconOnly && <span className="text-xl font-bold tracking-tight">ExamFlow</span>}
    </span>
  );
}
