// Line chart of stock In / Out / Adjust quantities for the last 7 days, drawn from real transactions.
import type { InventoryTransaction, TxType } from "@/types";

const colors: Record<TxType, string> = { IN: "#10b981", OUT: "#2563eb", ADJUST: "#f59e0b" };

export function MovementChart({ transactions }: { transactions: InventoryTransaction[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const series: Record<TxType, number[]> = { IN: Array(7).fill(0), OUT: Array(7).fill(0), ADJUST: Array(7).fill(0) };
  transactions.forEach((t) => {
    const index = days.findIndex((d) => d.toDateString() === new Date(t.createdAt).toDateString());
    if (index >= 0) series[t.type][index] += t.quantity;
  });

  const top = Math.max(20, Math.ceil(Math.max(...Object.values(series).flat()) / 20) * 20);
  const left = 34, right = 590, base = 200, height = 190;
  const x = (i: number) => left + (i * (right - left)) / 6;
  const y = (v: number) => base - (v / top) * height;

  return (
    <svg viewBox="0 0 600 232" className="w-full" role="img" aria-label="Inventory movement for the last 7 days">
      {[0, 1, 2, 3, 4].map((n) => {
        const value = (top / 4) * n;
        return (
          <g key={n}>
            <line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#e9eef5" />
            <text x={left - 8} y={y(value) + 4} textAnchor="end" fontSize="11" fill="#64748b">{Math.round(value)}</text>
          </g>
        );
      })}
      {(Object.keys(series) as TxType[]).map((type) => (
        <g key={type}>
          <polyline fill="none" stroke={colors[type]} strokeWidth="2.5" strokeLinejoin="round" points={series[type].map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
          {series[type].map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill={colors[type]} />)}
        </g>
      ))}
      {days.map((d, i) => (
        <text key={i} x={x(i)} y="224" textAnchor="middle" fontSize="11" fill="#475569">{d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text>
      ))}
    </svg>
  );
}
