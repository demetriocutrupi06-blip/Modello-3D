import { FEASIBILITY_LABELS } from "../schema";

const STYLE = {
  si: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  parziale: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  sconsigliato: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
} as const;

export function FeasibilityBadge({ value }: { value: keyof typeof FEASIBILITY_LABELS }) {
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STYLE[value] ?? STYLE.parziale}`}>{FEASIBILITY_LABELS[value] ?? value}</span>;
}
