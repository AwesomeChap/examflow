export type ClassValue = string | false | null | undefined;

/** Joins truthy class names; keeps Tailwind usage declarative without a dep. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
