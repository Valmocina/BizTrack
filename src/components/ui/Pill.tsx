// Small colored label (IN / OUT / status badges).
import type { ReactNode } from "react";

export const pillTone = {
  green: "bg-[#d6f5e5] text-[#16a36b]",
  red: "bg-[#ffe0e4] text-[#ee4a5a]",
  orange: "bg-[#ffeacc] text-[#f0971c]",
  blue: "bg-[#dbeafe] text-[#2563eb]",
  gray: "bg-slate-100 text-slate-500",
};

export function Pill({ tone, children }: { tone: keyof typeof pillTone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold ${pillTone[tone]}`}>{children}</span>;
}
