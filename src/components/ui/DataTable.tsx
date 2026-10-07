// Plain white table card with an empty state and optional footer. Used by most list pages.
import type { ReactNode } from "react";

export function DataTable({ columns, rows, loading, emptyText, footer, minWidth = 700 }: {
  columns: string[];
  rows: ReactNode[][];
  loading: boolean;
  emptyText: string;
  footer?: ReactNode;
  minWidth?: number;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]" style={{ minWidth }}>
          <thead>
            <tr className="bg-[#f7f9fc] text-slate-700">
              {columns.map((column) => <th key={column} className="px-5 py-3.5 font-semibold first:pl-6">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-[#e9eef5] text-slate-700">
                {row.map((cell, j) => <td key={j} className="px-5 py-4 first:pl-6">{cell}</td>)}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-slate-400">{loading ? "Loading..." : emptyText}</td></tr>}
          </tbody>
        </table>
      </div>
      {footer && <div className="flex items-center justify-between border-t border-[#e9eef5] px-6 py-4 text-xs text-slate-400">{footer}</div>}
    </section>
  );
}
