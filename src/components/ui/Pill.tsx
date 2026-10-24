// Small colored label (IN / OUT / status badges).
import type { ReactNode } from "react";

export const pillTone = {
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-rose-100 text-rose-800",
  orange: "bg-amber-100 text-amber-800",
  blue: "bg-blue-100 text-blue-800",
  gray: "bg-slate-100 text-slate-700",
};

export function Pill({ tone, children }: { tone: keyof typeof pillTone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-bold ${pillTone[tone]}`}>{children}</span>;
}
