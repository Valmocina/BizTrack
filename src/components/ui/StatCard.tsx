// Dashboard number card: round icon, label, big value and a small note on the right.
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/types";

export function StatCard({ icon, tint, label, value, change, note, warn }: {
  icon: IconName; tint: string; label: string; value: string | number; change?: string; note?: string; warn?: boolean;
}) {
  return (
    <article className="card flex items-center gap-4 p-5">
      <span className={`grid h-[50px] w-[50px] shrink-0 place-items-center rounded-full ${tint}`}><Icon name={icon} size={22} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800">{label}</p>
        <div className="flex items-end justify-between gap-2">
          <p className="text-[34px] font-bold leading-tight tracking-tight text-slate-800">{value}</p>
          <div className="mb-1 text-right">
            {change && <p className={`text-[11px] font-bold ${warn ? "text-amber-600" : "text-emerald-500"}`}>{warn ? "" : "↑ "}{change}</p>}
            {note && <p className="text-[10px] text-slate-400">{note}</p>}
          </div>
        </div>
      </div>
    </article>
  );
}
