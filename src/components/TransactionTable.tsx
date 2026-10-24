import type { ReactNode } from "react"

import { DataTable } from "@/components/ui/DataTable"

import { Icon } from "@/components/ui/Icon"

import { Pill } from "@/components/ui/Pill"

import { formatDate } from "@/services/format"

import type { InventoryTransaction, TxType } from "@/types"

const tone: Record<TxType, "green" | "red" | "orange"> = {
  IN: "green",

  OUT: "red",

  ADJUST: "orange",
}

const typeLabel: Record<TxType, string> = {
  IN: "STOCK IN",

  OUT: "STOCK OUT",

  ADJUST: "ADJUSTMENT",
}

type SortKey = "date" | "product" | "quantity" | "type"

export function TransactionTable({
  transactions,

  loading,

  footer,

  onArchive,

  onRestore,

  restoring = false,

  emptyText = "No inventory movements yet.",

  canSelect = false,

  selectedIds,

  onToggleSelected,

  onTogglePage,

  pageSelected = false,

  sortKey,

  sortDirection,

  onSort,

  onViewDetails,
}: {
  transactions: InventoryTransaction[]

  loading: boolean

  footer?: ReactNode

  onArchive?: (transaction: InventoryTransaction) => void

  onRestore?: (transaction: InventoryTransaction) => void

  restoring?: boolean

  emptyText?: string

  canSelect?: boolean

  selectedIds?: ReadonlySet<string>

  onToggleSelected?: (transactionId: string) => void

  onTogglePage?: () => void

  pageSelected?: boolean

  sortKey?: SortKey

  sortDirection?: "asc" | "desc"

  onSort?: (key: SortKey) => void

  onViewDetails?: (transaction: InventoryTransaction) => void
}) {
  const enhanced = Boolean(
    canSelect || onSort || onViewDetails || onArchive || onRestore,
  )

  const columns = [
    ...(canSelect ? ["Select"] : []),

    "Date",

    "Product",

    "Type",

    "Quantity",

    "Reference",

    ...(enhanced ? ["Reason", "User", "Actions"] : ["Remarks"]),
  ]

  const sortableHeader = (label: string, key: SortKey) => (
    <button
      type="button"
      onClick={() => onSort?.(key)}
      className="inline-flex items-center gap-1 text-inherit hover:text-blue-700"
      aria-label={`Sort by ${label}`}
    >
      {label}
      {sortKey === key ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
    </button>
  )

  const columnHeaders: ReactNode[] = enhanced
    ? [
        ...(canSelect
          ? [
              <input
                key="select-page"
                type="checkbox"
                checked={pageSelected}
                onChange={() => onTogglePage?.()}
                aria-label="Select all transactions on this page"
                disabled={transactions.length === 0 || restoring}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />,
            ]
          : []),

        sortableHeader("Date", "date"),

        sortableHeader("Product", "product"),

        sortableHeader("Type", "type"),

        sortableHeader("Quantity", "quantity"),

        "Reference",

        "Reason",

        "User",

        "Actions",
      ]
    : columns

  return (
    <DataTable
      columns={columns}
      columnHeaders={columnHeaders}
      minWidth={enhanced ? 1180 : 700}
      rows={transactions.map((transaction) => {
        const difference =
          transaction.previousStock === null || transaction.newStock === null
            ? null
            : transaction.newStock - transaction.previousStock

        const quantity =
          difference === null
            ? transaction.type === "IN"
              ? `+${transaction.quantity}`
              : transaction.type === "OUT"
                ? `-${transaction.quantity}`
                : String(transaction.quantity)
            : difference > 0
              ? `+${difference}`
              : String(difference)

        const row: ReactNode[] = [
          ...(canSelect
            ? [
                <input
                  type="checkbox"
                  checked={selectedIds?.has(transaction.id) ?? false}
                  onChange={() => onToggleSelected?.(transaction.id)}
                  aria-label={`Select ${transaction.productName} transaction`}
                  disabled={restoring}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />,
              ]
            : []),

          enhanced
            ? new Date(transaction.createdAt).toLocaleDateString(undefined, {
                month: "short",

                day: "numeric",

                year: "numeric",
              })
            : formatDate(transaction.createdAt),

          transaction.productName,

          <Pill tone={tone[transaction.type]}>
            {enhanced ? typeLabel[transaction.type] : transaction.type}
          </Pill>,

          enhanced ? (
            <span
              className={
                difference !== null && difference < 0
                  ? "font-semibold text-rose-700"
                  : "font-semibold text-emerald-700"
              }
            >
              {quantity}
            </span>
          ) : (
            transaction.quantity
          ),

          transaction.reference || "—",

          ...(enhanced
            ? [
                transaction.remarks || "—",

                transaction.createdByName || "Staff",

                <details className="relative">
                  <summary
                    aria-label={`Actions for ${transaction.productName} transaction`}
                    className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    <Icon name="more" size={18} />
                  </summary>
                  <div className="absolute right-0 z-10 mt-1 min-w-40 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      onClick={() => onViewDetails?.(transaction)}
                      disabled={!onViewDetails}
                    >
                      View Details
                    </button>
                    {onArchive && (
                      <button
                        type="button"
                        className="block w-full rounded px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                        onClick={() => onArchive(transaction)}
                        disabled={restoring}
                      >
                        Archive
                      </button>
                    )}
                    {onRestore && (
                      <button
                        type="button"
                        className="block w-full rounded px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        onClick={() => onRestore(transaction)}
                        disabled={restoring}
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </details>,
              ]
            : [transaction.remarks || "—"]),
        ]

        return row
      })}
      loading={loading}
      emptyText={emptyText}
      footer={footer}
    />
  )
}
