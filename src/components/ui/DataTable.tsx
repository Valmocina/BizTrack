// Plain white table card with an empty state and optional footer. Used by most list pages.
import type { ReactNode } from "react"

export function DataTable({
  columns,
  rows,
  loading,
  emptyText,
  footer,
  minWidth = 700,
  columnHeaders,
}: {
  columns: string[]
  rows: ReactNode[][]
  loading: boolean
  emptyText: string
  footer?: ReactNode
  minWidth?: number
  columnHeaders?: ReactNode[]
}) {
  return (
    <section className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table
          className="w-full text-left text-sm leading-6"
          style={{ minWidth }}
        >
          <thead>
            <tr className="bg-slate-50 text-slate-700">
              {columns.map((column, index) => (
                <th
                  key={column}
                  scope="col"
                  className="whitespace-nowrap px-5 py-4 text-xs font-bold uppercase tracking-wide first:pl-6"
                >
                  {columnHeaders?.[index] ?? column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-t border-[#e9eef5] text-slate-700 transition-colors hover:bg-slate-50/70"
              >
                {row.map((cell, j) => (
                  <td key={j} className="px-5 py-4 align-middle first:pl-6">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-sm font-medium text-slate-600"
                >
                  {loading ? "Loading..." : emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {footer && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e9eef5] px-6 py-4 text-sm text-slate-600">
          {footer}
        </div>
      )}
    </section>
  )
}
