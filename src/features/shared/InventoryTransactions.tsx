import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"

import { Icon } from "@/components/ui/Icon"

import { StatCard } from "@/components/ui/StatCard"

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

import { listProfiles } from "@/services/userService"

import type {
  InventoryTransaction,
  Notify,
  Product,
  Profile,
  TxType,
} from "@/types"

type DateRange = "all" | "today" | "7" | "30" | "month" | "custom"

type SortKey = "date" | "product" | "quantity" | "type"

type SortDirection = "asc" | "desc"

function getRangeStart(range: DateRange, from: string) {
  if (range === "custom") return from ? new Date(`${from}T00:00:00`) : null

  if (range === "all") return null

  const start = new Date()

  start.setHours(0, 0, 0, 0)

  if (range === "month") start.setDate(1)
  else if (range === "today") return start
  else start.setDate(start.getDate() - (Number(range) - 1))

  return start
}

function getRangeEnd(range: DateRange, to: string) {
  if (range !== "custom" || !to) return null

  const end = new Date(`${to}T00:00:00`)

  end.setDate(end.getDate() + 1)

  return end
}

function transactionDelta(transaction: InventoryTransaction) {
  if (transaction.previousStock !== null && transaction.newStock !== null) {
    return transaction.newStock - transaction.previousStock
  }

  if (transaction.type === "IN") return transaction.quantity

  if (transaction.type === "OUT") return -transaction.quantity

  return null
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

  const profiles = useLoad(listProfiles, [] as Profile[], notify, "users")

  const [range, setRange] = useState<DateRange>("all")

  const [fromDate, setFromDate] = useState("")

  const [toDate, setToDate] = useState("")

  const [typeFilter, setTypeFilter] = useState<"all" | TxType>("all")

  const [productFilter, setProductFilter] = useState("all")

  const [recordView, setRecordView] = useState<"active" | "archived">("active")

  const [transactionQuery, setTransactionQuery] = useState("")

  const [productQuery, setProductQuery] = useState("")

  const [selectedMovementProduct, setSelectedMovementProduct] = useState("")

  const [showForm, setShowForm] = useState(false)

  const [saving, setSaving] = useState(false)

  const [archiving, setArchiving] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const [selectedTransaction, setSelectedTransaction] =
    useState<InventoryTransaction | null>(null)

  const [sortKey, setSortKey] = useState<SortKey>("date")

  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  const [pageSize, setPageSize] = useState(20)

  const [page, setPage] = useState(1)

  const exportMenu = useRef<HTMLDetailsElement>(null)

  const profileNames = useMemo(
    () =>
      new Map(profiles.data.map((profile) => [profile.id, profile.fullName])),

    [profiles.data],
  )

  const transactions = useMemo(
    () =>
      tx.data.map((transaction) => ({
        ...transaction,

        createdByName: transaction.createdBy
          ? profileNames.get(transaction.createdBy) || "Staff"
          : "System",
      })),

    [profileNames, tx.data],
  )

  const activeTransactions = transactions.filter(
    (transaction) => !transaction.isArchived,
  )

  const archivedTransactions = transactions.filter(
    (transaction) => transaction.isArchived,
  )

  const activeList =
    recordView === "active" ? activeTransactions : archivedTransactions

  const rangeStart = getRangeStart(range, fromDate)

  const rangeEnd = getRangeEnd(range, toDate)

  const query = transactionQuery.trim().toLowerCase()

  const filteredTransactions = activeList.filter((transaction) => {
    const createdAt = new Date(transaction.createdAt)

    return (
      (!rangeStart || createdAt >= rangeStart) &&
      (!rangeEnd || createdAt < rangeEnd) &&
      (typeFilter === "all" || transaction.type === typeFilter) &&
      (productFilter === "all" || transaction.productId === productFilter) &&
      (!query ||
        [
          transaction.id,

          transaction.productName,

          transaction.reference,

          transaction.remarks,

          transaction.createdByName || "",
        ]

          .join(" ")

          .toLowerCase()

          .includes(query))
    )
  })

  const sortedTransactions = [...filteredTransactions].sort((left, right) => {
    let comparison = 0

    if (sortKey === "date") {
      comparison =
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    } else if (sortKey === "product") {
      comparison = left.productName.localeCompare(right.productName)
    } else if (sortKey === "type") {
      comparison = left.type.localeCompare(right.type)
    } else {
      comparison =
        (transactionDelta(left) ?? left.quantity) -
        (transactionDelta(right) ?? right.quantity)
    }

    return sortDirection === "asc" ? comparison : -comparison
  })

  const pageCount = Math.max(1, Math.ceil(sortedTransactions.length / pageSize))

  const currentPage = Math.min(page, pageCount)

  const pageTransactions = sortedTransactions.slice(
    (currentPage - 1) * pageSize,

    currentPage * pageSize,
  )

  const selectedOnPage = pageTransactions.every((transaction) =>
    selectedIds.has(transaction.id),
  )

  const matchingProducts = products.data.filter((product) =>
    `${product.name} ${product.sku}`

      .toLowerCase()

      .includes(productQuery.trim().toLowerCase()),
  )

  const selectedMovementProductRecord = products.data.find(
    (product) => product.id === selectedMovementProduct,
  )

  const movementProductOptions =
    selectedMovementProductRecord &&
    !matchingProducts.some(
      (product) => product.id === selectedMovementProductRecord.id,
    )
      ? [selectedMovementProductRecord, ...matchingProducts]
      : matchingProducts

  useEffect(() => {
    setPage(1)
  }, [
    range,
    fromDate,
    toDate,
    typeFilter,
    productFilter,
    transactionQuery,
    recordView,
    pageSize,
  ])

  const exportExcel = async (
    records: InventoryTransaction[],

    filename: string,
  ) => {
    await downloadExcel(filename, "Inventory Transactions", [
      [
        "Transaction ID",

        "Date",

        "Product",

        "Type",

        "Quantity",

        "Previous Stock",

        "New Stock",

        "Reference",

        "Reason",

        "User",
      ],

      ...records.map((transaction) => {
        const delta = transactionDelta(transaction)

        return [
          transaction.id,

          transaction.createdAt,

          transaction.productName,

          transaction.type,

          delta === null ? String(transaction.quantity) : String(delta),

          transaction.previousStock === null
            ? ""
            : String(transaction.previousStock),

          transaction.newStock === null ? "" : String(transaction.newStock),

          transaction.reference,

          transaction.remarks,

          transaction.createdByName || "Staff",
        ]
      }),
    ])
  }

  const handleExport = async (
    records: InventoryTransaction[],

    label: string,
  ) => {
    try {
      await exportExcel(
        records,

        `inventory-transactions-${label}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      )

      notify(`${records.length} transactions exported to Excel.`)
    } catch (error) {
      notify(`Could not export transactions: ${(error as Error).message}`)
    } finally {
      if (exportMenu.current) exportMenu.current.open = false
    }
  }

  const archiveSelected = async (ids: string[]) => {
    if (!canArchive || ids.length === 0) return

    if (!window.confirm(`Archive ${ids.length} selected transaction(s)?`))
      return

    setArchiving(true)

    try {
      await archiveInventoryTransactions(ids)

      setSelectedIds((current) => {
        const next = new Set(current)

        ids.forEach((id) => next.delete(id))

        return next
      })

      notify(`${ids.length} transaction(s) archived.`)

      await tx.reload()
    } catch (error) {
      notify(`Could not archive transactions: ${(error as Error).message}`)
    } finally {
      setArchiving(false)
    }
  }

  const restoreSelected = async (ids: string[]) => {
    if (!canArchive || ids.length === 0) return

    if (!window.confirm(`Restore ${ids.length} selected transaction(s)?`))
      return

    setArchiving(true)

    try {
      await restoreInventoryTransactions(ids)

      setSelectedIds((current) => {
        const next = new Set(current)

        ids.forEach((id) => next.delete(id))

        return next
      })

      notify(`${ids.length} transaction(s) restored.`)

      await tx.reload()
    } catch (error) {
      notify(`Could not restore transactions: ${(error as Error).message}`)
    } finally {
      setArchiving(false)
    }
  }

  const handleSingleArchive = async (transaction: InventoryTransaction) => {
    await archiveSelected([transaction.id])
  }

  const handleSingleRestore = async (transaction: InventoryTransaction) => {
    await restoreSelected([transaction.id])
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)

      if (next.has(id)) next.delete(id)
      else next.add(id)

      return next
    })
  }

  const togglePageSelected = () => {
    setSelectedIds((current) => {
      const next = new Set(current)

      if (selectedOnPage) pageTransactions.forEach(({ id }) => next.delete(id))
      else pageTransactions.forEach(({ id }) => next.add(id))

      return next
    })
  }

  const changeSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)

      setSortDirection(key === "date" ? "desc" : "asc")
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canArchive) {
      notify("Only administrators can record inventory movements.")

      return
    }

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

      setSelectedMovementProduct("")

      setProductQuery("")

      await tx.reload()
    } catch (error) {
      notify(`Could not save: ${(error as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  const dateLabel =
    range === "all"
      ? "All time"
      : range === "today"
        ? "Today"
        : range === "7"
          ? "Last 7 days"
          : range === "30"
            ? "Last 30 days"
            : range === "month"
              ? "This month"
              : "Custom range"

  const quantityText = (transaction: InventoryTransaction) => {
    const delta = transactionDelta(transaction)

    return delta === null
      ? String(transaction.quantity)
      : delta > 0
        ? `+${delta}`
        : String(delta)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Inventory Transactions</h1>
          <p className="mt-1 text-sm text-slate-600">
            Review, filter, and manage stock movement history.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canArchive && recordView === "active" && (
            <button
              className="btn-secondary !h-10"
              onClick={() => setShowForm((open) => !open)}
            >
              <Icon name="plus" size={16} /> Record movement
            </button>
          )}
          {canArchive && selectedIds.size > 0 && (
            <button
              type="button"
              className="btn-secondary !h-10"
              onClick={() =>
                recordView === "active"
                  ? void archiveSelected([...selectedIds])
                  : void restoreSelected([...selectedIds])
              }
              disabled={archiving}
            >
              {recordView === "active"
                ? "Archive Selected"
                : "Restore Selected"}{" "}
              ({selectedIds.size})
            </button>
          )}
          <details ref={exportMenu} className="relative">
            <summary className="btn-primary !h-10 cursor-pointer list-none">
              Export <span aria-hidden="true">▼</span>
            </summary>
            <div className="absolute right-0 z-20 mt-1 min-w-52 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
              <button
                className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() =>
                  void handleExport(sortedTransactions, "current-view")
                }
              >
                Export Current View
              </button>
              <button
                className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => void handleExport(transactions, "all")}
              >
                Export All Transactions
              </button>
              <button
                className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => void handleExport(activeTransactions, "active")}
              >
                Export Active Transactions
              </button>
              <button
                className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() =>
                  void handleExport(archivedTransactions, "archived")
                }
              >
                Export Archived Transactions
              </button>
            </div>
          </details>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["active", "archived"] as const).map((view) => (
          <button
            key={view}
            type="button"
            aria-pressed={recordView === view}
            onClick={() => {
              setRecordView(view)
              setSelectedIds(new Set())
            }}
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

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={range}
          onChange={(event) => setRange(event.target.value as DateRange)}
          className="input !h-10 !w-auto"
          aria-label="Date range"
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="month">This month</option>
          <option value="custom">Custom range</option>
        </select>
        {range === "custom" && (
          <>
            <label className="sr-only" htmlFor="transaction-date-from">
              Start date
            </label>
            <input
              id="transaction-date-from"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="input !h-10 !w-auto"
              aria-label="Custom range start date"
            />
            <label className="sr-only" htmlFor="transaction-date-to">
              End date
            </label>
            <input
              id="transaction-date-to"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
              className="input !h-10 !w-auto"
              aria-label="Custom range end date"
            />
          </>
        )}
        <select
          value={typeFilter}
          onChange={(event) =>
            setTypeFilter(
              event.target.value === "IN" ||
                event.target.value === "OUT" ||
                event.target.value === "ADJUST"
                ? event.target.value
                : "all",
            )
          }
          className="input !h-10 !w-auto"
          aria-label="Transaction type"
        >
          <option value="all">All Types</option>
          <option value="IN">Stock In</option>
          <option value="OUT">Stock Out</option>
          <option value="ADJUST">Adjustment</option>
        </select>
        <select
          value={productFilter}
          onChange={(event) => setProductFilter(event.target.value)}
          className="input !h-10 !w-auto"
          aria-label="Filter by product"
        >
          <option value="all">All Products</option>
          {Array.from(
            new Map(
              transactions.map(({ productId, productName }) => [
                productId,

                productName,
              ]),
            ),
          ).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <label className="flex h-10 min-w-56 flex-1 items-center gap-2 rounded-md border border-[#e5ebf3] bg-white px-3 text-slate-500">
          <Icon name="search" size={16} />
          <input
            type="search"
            value={transactionQuery}
            onChange={(event) => setTransactionQuery(event.target.value)}
            className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-500"
            placeholder="Search transactions..."
            aria-label="Search product, reference, reason, user, or transaction ID"
          />
        </label>
      </div>

      {range === "custom" && fromDate && toDate && fromDate > toDate && (
        <p className="text-sm font-medium text-rose-700">
          The end date must be on or after the start date.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon="activity"
          tint="bg-blue-50 text-blue-700"
          label="Total Transactions"
          value={filteredTransactions.length}
          note={dateLabel}
        />
        <StatCard
          icon="download"
          tint="bg-emerald-50 text-emerald-700"
          label="Stock In"
          value={
            filteredTransactions.filter(({ type }) => type === "IN").length
          }
          note="Matching transactions"
        />
        <StatCard
          icon="upload"
          tint="bg-rose-50 text-rose-700"
          label="Stock Out"
          value={
            filteredTransactions.filter(({ type }) => type === "OUT").length
          }
          note="Matching transactions"
        />
        <StatCard
          icon="settings"
          tint="bg-amber-50 text-amber-700"
          label="Adjustments"
          value={
            filteredTransactions.filter(({ type }) => type === "ADJUST").length
          }
          note="Matching transactions"
        />
      </div>

      {showForm && recordView === "active" && canArchive && (
        <form
          onSubmit={submit}
          className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div className="field">
            <span>Product</span>
            <label className="flex h-10 items-center gap-2 rounded-md border border-[#e5ebf3] bg-white px-3 text-slate-500">
              <Icon name="search" size={16} />
              <input
                type="search"
                value={productQuery}
                onChange={(event) => setProductQuery(event.target.value)}
                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-500"
                placeholder="Search products..."
                aria-label="Search products for inventory movement"
              />
            </label>
            <select
              name="product"
              required
              value={selectedMovementProduct}
              onChange={(event) =>
                setSelectedMovementProduct(event.target.value)
              }
            >
              <option value="" disabled>
                {matchingProducts.length
                  ? "Select product"
                  : "No matching products"}
              </option>
              {movementProductOptions.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.stock} in stock)
                </option>
              ))}
            </select>
          </div>
          <label className="field">
            <span>Type</span>
            <select name="type" defaultValue="IN">
              <option value="IN">Stock In (add stock)</option>
              <option value="OUT">Stock Out (remove stock)</option>
              <option value="ADJUST">Adjustment (set stock to quantity)</option>
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
            <span>Reason</span>
            <input name="remarks" placeholder="Optional" />
          </label>
          <div className="sm:col-span-2 lg:col-span-5">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save movement"}
            </button>
          </div>
        </form>
      )}

      <TransactionTable
        transactions={pageTransactions}
        loading={tx.loading}
        emptyText={
          query ||
          range !== "all" ||
          typeFilter !== "all" ||
          productFilter !== "all"
            ? "No transactions match these filters."
            : `No ${recordView} inventory movements yet.`
        }
        canSelect={canArchive}
        selectedIds={selectedIds}
        onToggleSelected={toggleSelected}
        onTogglePage={togglePageSelected}
        pageSelected={pageTransactions.length > 0 && selectedOnPage}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={changeSort}
        onViewDetails={setSelectedTransaction}
        onArchive={
          canArchive && recordView === "active"
            ? handleSingleArchive
            : undefined
        }
        onRestore={
          canArchive && recordView === "archived"
            ? handleSingleRestore
            : undefined
        }
        restoring={archiving}
        footer={
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Showing{" "}
                {sortedTransactions.length === 0
                  ? "0"
                  : `${(currentPage - 1) * pageSize + 1}–${Math.min(
                      currentPage * pageSize,

                      sortedTransactions.length,
                    )}`}{" "}
                of {sortedTransactions.length} transactions
              </span>
              <label className="ml-2 flex items-center gap-2">
                <span>Per page</span>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="input !h-8 !w-auto !py-0"
                  aria-label="Transactions per page"
                >
                  {[20, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <nav
              aria-label="Transaction pages"
              className="flex items-center gap-1"
            >
              <button
                type="button"
                className="btn-secondary !h-8 !px-3"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage <= 1}
              >
                Previous
              </button>
              {Array.from({ length: pageCount }, (_, index) => index + 1)

                .filter(
                  (pageNumber) =>
                    pageNumber === 1 ||
                    pageNumber === pageCount ||
                    Math.abs(pageNumber - currentPage) <= 1,
                )

                .map((pageNumber, index, pages) => (
                  <span key={pageNumber} className="contents">
                    {index > 0 && pages[index - 1] !== pageNumber - 1 && (
                      <span className="px-1 text-slate-500" aria-hidden="true">
                        …
                      </span>
                    )}
                    <button
                      type="button"
                      aria-current={
                        currentPage === pageNumber ? "page" : undefined
                      }
                      className={`h-8 min-w-8 rounded-md px-2 text-sm ${
                        currentPage === pageNumber
                          ? "bg-blue-600 font-semibold text-white"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  </span>
                ))}
              <button
                type="button"
                className="btn-secondary !h-8 !px-3"
                onClick={() =>
                  setPage((current) => Math.min(pageCount, current + 1))
                }
                disabled={currentPage >= pageCount}
              >
                Next
              </button>
            </nav>
          </>
        }
      />

      {selectedTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setSelectedTransaction(null)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-details-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="transaction-details-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Transaction #{selectedTransaction.id}
                </h2>
                <p className="mt-1 text-sm text-slate-600">Movement details</p>
              </div>
              <button
                type="button"
                className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
                onClick={() => setSelectedTransaction(null)}
                aria-label="Close transaction details"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <dl className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2">
              {[
                ["Product", selectedTransaction.productName],

                [
                  "Transaction Type",

                  selectedTransaction.type === "IN"
                    ? "Stock In"
                    : selectedTransaction.type === "OUT"
                      ? "Stock Out"
                      : "Adjustment",
                ],

                ["Quantity", quantityText(selectedTransaction)],

                [
                  "Previous Stock",

                  selectedTransaction.previousStock === null
                    ? "Not recorded"
                    : String(selectedTransaction.previousStock),
                ],

                [
                  "New Stock",

                  selectedTransaction.newStock === null
                    ? "Not recorded"
                    : String(selectedTransaction.newStock),
                ],

                ["Reference", selectedTransaction.reference || "—"],

                ["Reason", selectedTransaction.remarks || "—"],

                ["Performed By", selectedTransaction.createdByName || "Staff"],

                [
                  "Date",

                  new Date(selectedTransaction.createdAt).toLocaleDateString(
                    undefined,

                    { month: "long", day: "numeric", year: "numeric" },
                  ),
                ],

                [
                  "Time",

                  new Date(selectedTransaction.createdAt).toLocaleTimeString(
                    undefined,

                    { hour: "numeric", minute: "2-digit" },
                  ),
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-medium text-slate-900">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedTransaction(null)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
