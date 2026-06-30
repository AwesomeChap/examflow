/** Consistent display for stored answer values (e.g. true/false → True/False). */
export function formatAnswerDisplay(value: string): string {
  if (value === "true") return "True";
  if (value === "false") return "False";
  return value;
}
