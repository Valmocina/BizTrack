// Inventory Transactions: filtered history, Excel export and a form to record stock movements.
import { useState, type FormEvent } from "react"
import { Icon } from "@/components/ui/Icon"
import { TransactionTable } from "@/components/TransactionTable"
import { useLoad } from "@/hooks/useLoad"
import { downloadExcel } from "@/services/excel"
import {
  archiveInventoryTransactions,
  createTransaction,
  listTransactions,
  restoreInventoryTransactions,
} from "@/services/inventoryService"
import { listProducts } from "@/services/productService"
import type { InventoryTransaction, Notify, Product, TxType } from "@/types"

const ranges: Record<string, string> = {
  "7": "Last 7 days",
  "30": "Last 30 days",
  month: "This month",
  all: "All time",
}

function rangeStart(range: string) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (range === "all") return null
  if (range === "month") start.setDate(1)
  else start.setDate(start.getDate() - (Number(range) - 1))
  return start
}

export function InventoryTransactions({
  notify,
  canArchive,
}: {
  notify: Notify
  canArchive: boolean
}) {
  const tx = useLoad(
    listTransactions,
    [] as InventoryTransaction[],
    notify,
    "transactions",
  )
  const products = useLoad(listProducts, [] as Product[], notify, "products")
  const [range, setRange] = useState("all")
  const [typeFilter, setTypeFilter] = useState<"All types" | TxType>(
    "All types",
  )
  const [recordView, setRecordView] = useState<"active" | "archived">("active")
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const start = rangeStart(range)
  const activeTransactions = tx.data.filter(
    (transaction) => !transaction.isArchived,
  )
  const archivedTransactions = tx.data.filter(
    (transaction) => transaction.isArchived,
  )
  const visible = (
    recordView === "active" ? activeTransactions : archivedTransactions
  ).filter(
    (transaction) =>
      (!start || new Date(transaction.createdAt) >= start) &&
      (typeFilter === "All types" || transaction.type === typeFilter),
  )
  const label = start
    ? `${start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} → ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
    : "All time"

  const exportExcel = async (
    transactions: InventoryTransaction[],
    filename: string,
  ) => {
    await downloadExcel(filename, "Inventory Transactions", [
      ["Date", "Product", "Type", "Quantity", "Reference", "Remarks"],
      ...transactions.map((transaction) => [
        transaction.createdAt,
        transaction.productName,
        transaction.type,
        String(transaction.quantity),
        transaction.reference,
        transaction.remarks,
      ]),
    ])
  }

  const handleExport = async () => {
    try {
      await exportExcel(visible, "inventory-transactions.xlsx")
      notify("Transactions exported to Excel.")
    } catch (error) {
      notify(`Could not export transactions: ${(error as Error).message}`)
    }
  }

  const handleArchive = async () => {
    if (visible.length === 0) return
    if (
      !window.confirm(
        `Export ${visible.length} filtered inventory transactions to Excel and archive them?`,
      )
    )
      return

    setArchiving(true)
    try {
      const filename = `inventory-transactions-archive-${new Date().toISOString().slice(0, 10)}.xlsx`
      await exportExcel(visible, filename)
      await archiveInventoryTransactions(
        visible.map((transaction) => transaction.id),
      )
      notify(`${visible.length} transactions exported and archived.`)
      await tx.reload()
    } catch (error) {
      notify(
        `Could not export and archive transactions: ${(error as Error).message}`,
      )
    } finally {
      setArchiving(false)
    }
  }

  const handleRestore = async () => {
    setArchiving(true)
    try {
      await restoreInventoryTransactions(
        visible.map((transaction) => transaction.id),
      )
      notify(`${visible.length} transactions restored.`)
      await tx.reload()
    } catch (error) {
      notify(`Could not restore transactions: ${(error as Error).message}`)
    } finally {
      setArchiving(false)
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const text = (key: string) => String(form.get(key) ?? "").trim()
    setSaving(true)
    try {
      await createTransaction({
        productId: text("product"),
        type: text("type") as TxType,
        quantity: Number(text("quantity")),
        reference: text("reference"),
        remarks: text("remarks"),
      })
      notify("Movement recorded and stock updated.")
      setShowForm(false)
      await tx.reload()
    } catch (error) {
      notify(`Could not save: ${(error as Error).message}`)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <h1 className="page-title">Inventory Transactions</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex h-10 items-center gap-2.5 rounded-md bg-white px-3.5 text-sm text-slate-700">
          <Icon name="calendar" size={16} className="text-slate-400" />
          {label}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="input !h-10 !w-auto"
            aria-label="Date range"
          >
            {Object.entries(ranges).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(event) => {
              const value = event.target.value
              setTypeFilter(
                value === "IN" || value === "OUT" || value === "ADJUST"
                  ? value
                  : "All types",
              )
            }}
            className="input !h-10 !w-auto"
            aria-label="Transaction type"
          >
            <option>All types</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
            <option value="ADJUST">ADJUST</option>
          </select>
          {recordView === "active" && (
            <button
              className="btn-secondary !h-10"
              onClick={() => setShowForm(!showForm)}
            >
              <Icon name="plus" size={16} /> Record movement
            </button>
          )}
          <button className="btn-primary !h-10" onClick={handleExport}>
            Export Excel
          </button>

          {canArchive && recordView === "active" && visible.length > 0 && (
            <button
              type="button"
              className="btn-secondary !h-10 flex items-center gap-1.5"
              onClick={handleArchive}
              disabled={archiving}
              title="Export filtered transactions to Excel and archive them"
            >
              <Icon name="download" size={16} />{" "}
              {archiving ? "Archiving..." : `Archive (${visible.length})`}
            </button>
          )}

          {canArchive && recordView === "archived" && visible.length > 0 && (
            <button
              type="button"
              className="btn-secondary !h-10"
              onClick={handleRestore}
              disabled={archiving}
            >
              {archiving ? "Restoring..." : `Restore (${visible.length})`}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["active", "archived"] as const).map((view) => (
          <button
            key={view}
            type="button"
            aria-pressed={recordView === view}
            onClick={() => setRecordView(view)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              recordView === view
                ? "border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]"
                : "border-[#e5ebf3] bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {view === "active" ? "Active" : "Archived"} (
            {view === "active"
              ? activeTransactions.length
              : archivedTransactions.length}
            )
          </button>
        ))}
      </div>

      {showForm && recordView === "active" && (
        <form
          onSubmit={submit}
          className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5"
        >
          <label className="field">
            <span>Product</span>
            <select name="product" required defaultValue="">
              <option value="" disabled>
                Select product
              </option>
              {products.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Type</span>
            <select name="type" defaultValue="IN">
              <option value="IN">IN (add stock)</option>
              <option value="OUT">OUT (remove stock)</option>
              <option value="ADJUST">ADJUST (set stock to quantity)</option>
            </select>
          </label>
          <label className="field">
            <span>Quantity</span>
            <input
              name="quantity"
              required
              type="number"
              min="0"
              placeholder="0"
            />
          </label>
          <label className="field">
            <span>Reference</span>
            <input name="reference" placeholder="e.g. PO-102" />
          </label>
          <label className="field">
            <span>Remarks</span>
            <input name="remarks" placeholder="Optional" />
          </label>
          <div className="sm:col-span-2 lg:col-span-5">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save movement"}
            </button>
          </div>
        </form>
      )}

      <TransactionTable transactions={visible} loading={tx.loading} />
    </div>
  )
}
