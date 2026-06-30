import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type ContainerProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Centers content and caps its width so layouts never stretch edge-to-edge on
 * wide screens. Padding steps up once at the single `sm` breakpoint.
 */
export function Container({ children, className }: ContainerProps) {
  return <div className={cn("mx-auto w-full max-w-5xl px-4 sm:px-6", className)}>{children}</div>;
}
