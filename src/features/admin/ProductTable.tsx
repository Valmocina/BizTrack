import { useState } from "react"
import { DataTable } from "@/components/ui/DataTable"
import { Icon } from "@/components/ui/Icon"
import { Pill } from "@/components/ui/Pill"
import { useLoad } from "@/hooks/useLoad"
import { formatPrice } from "@/services/format"
import {
  archiveProduct,
  archiveProducts,
  categoryTone,
  deleteArchivedProduct,
  listProducts,
  restoreProduct,
  restoreProducts,
  stockStatus,
} from "@/services/productService"
import type { Notify, Product, StockStatus } from "@/types"

const statusTone: Record<StockStatus, "green" | "red" | "gray"> = {
  "In Stock": "green",
  "Low Stock": "red",
  "Out of Stock": "gray",
}

export function ProductTable({
  notify,
  canEdit,
  initialQuery,
  onAdd,
  onEdit,
}: {
  notify: Notify
  canEdit: boolean
  initialQuery: string
  onAdd: () => void
  onEdit: (product: Product) => void
}) {
  const {
    data: items,
    setData: setItems,
    loading,
  } = useLoad(listProducts, [] as Product[], notify, "products")
  const [query, setQuery] = useState(initialQuery)
  const [statusFilter, setStatusFilter] =
    useState<"All statuses" | StockStatus>("All statuses")
  const [categoryFilter, setCategoryFilter] = useState("All categories")
  const [recordView, setRecordView] = useState<"active" | "archived">("active")

  const activeProducts = items.filter((product) => product.isActive ?? true)
  const archivedProducts = items.filter(
    (product) => !(product.isActive ?? true),
  )

  const categories = [
    ...new Set(
      items.map((product) => product.category.trim() || "Uncategorized"),
    ),
  ].sort((a, b) => a.localeCompare(b))

  const visibleProducts =
    recordView === "active" ? activeProducts : archivedProducts
  const filtered = visibleProducts.filter((product) => {
    const category = product.category.trim() || "Uncategorized"
    return (
      `${product.name} ${product.sku} ${product.category}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (statusFilter === "All statuses" ||
        stockStatus(product) === statusFilter) &&
      (categoryFilter === "All categories" || category === categoryFilter)
    )
  })

  const archive = async (product: Product) => {
    if (!window.confirm(`Archive ${product.name}?`)) return
    try {
      await archiveProduct(product.id)
      setItems((current) =>
        current.map((p) =>
          p.id === product.id ? { ...p, isActive: false } : p,
        ),
      )
      notify(`${product.name} was archived.`)
    } catch (error) {
      notify(`Could not archive: ${(error as Error).message}`)
    }
  }

  const restore = async (product: Product) => {
    if (!window.confirm(`Restore ${product.name}?`)) return
    try {
      await restoreProduct(product.id)
      setItems((current) =>
        current.map((p) =>
          p.id === product.id ? { ...p, isActive: true } : p,
        ),
      )
      notify(`${product.name} was restored.`)
    } catch (error) {
      notify(`Could not restore: ${(error as Error).message}`)
    }
  }

  const archiveVisible = async () => {
    if (
      !window.confirm(
        `Archive these ${filtered.length} products? You can restore them from the Archived tab.`,
      )
    )
      return

    try {
      await archiveProducts(filtered.map((product) => product.id))
      const archivedIds = new Set(filtered.map((product) => product.id))
      setItems((current) =>
        current.map((product) =>
          archivedIds.has(product.id)
            ? { ...product, isActive: false }
            : product,
        ),
      )
      notify("Products were archived.")
    } catch (error) {
      notify(`Could not archive products: ${(error as Error).message}`)
    }
  }

  const restoreVisible = async () => {
    try {
      await restoreProducts(filtered.map((product) => product.id))
      const restoredIds = new Set(filtered.map((product) => product.id))
      setItems((current) =>
        current.map((product) =>
          restoredIds.has(product.id)
            ? { ...product, isActive: true }
            : product,
        ),
      )
      notify("Products were restored.")
    } catch (error) {
      notify(`Could not restore products: ${(error as Error).message}`)
    }
  }

  const deleteToArchive = async (product: Product) => {
    if (
      !window.confirm(
        `Move ${product.name} to Archived? You can restore it later.`,
      )
    )
      return

    try {
      await archiveProduct(product.id)
      setItems((current) =>
        current.map((p) =>
          p.id === product.id ? { ...p, isActive: false } : p,
        ),
      )
      notify(`${product.name} was moved to Archived.`)
    } catch (error) {
      notify(`Could not archive: ${(error as Error).message}`)
    }
  }

  const permanentlyDelete = async (product: Product) => {
    if (
      !window.confirm(
        `Permanently delete archived product ${product.name}? This cannot be undone. Linked supplier records and inventory history may also be removed.`,
      )
    )
      return
    try {
      await deleteArchivedProduct(product.id)
      setItems((current) => current.filter((item) => item.id !== product.id))
      notify(`${product.name} was permanently deleted.`)
    } catch (error) {
      notify(
        `Could not permanently delete product: ${(error as Error).message}`,
      )
    }
  }

  const columns = [
    "ID",
    "Name",
    "Category",
    "Selling Price",
    "Supplier Cost",
    "Profit Margin",
    "Stock",
    "Status",
    ...(canEdit ? ["Actions"] : []),
  ]

  const rows = filtered.map((p) => {
    const status = stockStatus(p)
    const cost = p.cost || 0
    const price = p.price || 0
    const profit = price - cost
    const margin = price > 0 ? ((profit / price) * 100).toFixed(1) : "0.0"

    return [
      p.sku,
      p.name,
      p.category ? (
        <span
          className={`rounded px-2 py-1 text-[11px] font-bold ${categoryTone(p.category)}`}
        >
          {p.category}
        </span>
      ) : (
        "—"
      ),
      formatPrice(price),
      cost > 0 ? (
        formatPrice(cost)
      ) : (
        <span className="text-slate-400 italic">No link</span>
      ),
      cost > 0 ? (
        <span
          className={`font-semibold ${
            profit >= 0 ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {formatPrice(profit)} ({margin}%)
        </span>
      ) : (
        <span className="text-slate-400">—</span>
      ),
      p.stock,
      <Pill tone={statusTone[status]}>
        {status === "In Stock" && (
          <span className="h-2 w-2 rounded-full border border-current" />
        )}
        {status}
      </Pill>,
      ...(canEdit
        ? [
            <div className="flex gap-3 text-slate-400">
              <button
                onClick={() => onEdit(p)}
                className="hover:text-blue-600"
                aria-label={`Edit ${p.name}`}
              >
                <Icon name="edit" size={18} />
              </button>
              <button
                onClick={() => (p.isActive === false ? restore(p) : archive(p))}
                className={`inline-flex items-center gap-1 ${
                  p.isActive === false
                    ? "hover:text-emerald-600"
                    : "hover:text-amber-600"
                }`}
                aria-label={
                  p.isActive === false
                    ? `Restore ${p.name}`
                    : `Archive ${p.name}`
                }
                title={
                  p.isActive === false
                    ? `Restore ${p.name}`
                    : `Archive ${p.name}`
                }
              >
                <Icon
                  name={p.isActive === false ? "eye" : "eyeoff"}
                  size={18}
                />
                <span>{p.isActive === false ? "Restore" : "Archive"}</span>
              </button>
              {p.isActive === false ? (
                <button
                  onClick={() => permanentlyDelete(p)}
                  className="inline-flex items-center gap-1 text-rose-700 hover:text-rose-900"
                  aria-label={`Permanently delete ${p.name}`}
                  title={`Permanently delete ${p.name}`}
                >
                  <Icon name="trash" size={18} />
                  <span>Delete</span>
                </button>
              ) : (
                <button
                  onClick={() => deleteToArchive(p)}
                  className="hover:text-rose-600"
                  aria-label={`Delete ${p.name}`}
                  title={`Move ${p.name} to Archived`}
                >
                  <Icon name="trash" size={18} />
                </button>
              )}
            </div>,
          ]
        : []),
    ]
  })

  return (
    <div className="space-y-5">
      <h1 className="page-title">Products</h1>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="flex h-11 w-full max-w-[350px] items-center gap-3 rounded-md border border-[#e5ebf3] bg-white px-3.5 text-slate-400">
          <Icon name="search" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            placeholder="Search products..."
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && recordView === "active" && filtered.length > 0 && (
            <button className="btn-secondary" onClick={archiveVisible}>
              Archive ({filtered.length})
            </button>
          )}
          {canEdit && recordView === "archived" && filtered.length > 0 && (
            <button className="btn-secondary" onClick={restoreVisible}>
              Restore ({filtered.length})
            </button>
          )}
          {canEdit && (
            <button className="btn-primary" onClick={onAdd}>
              <Icon name="plus" size={16} /> Add Product
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="field !mb-0 flex-row items-center gap-2">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                const value = event.target.value
                setStatusFilter(
                  value === "In Stock" ||
                    value === "Low Stock" ||
                    value === "Out of Stock"
                    ? value
                    : "All statuses",
                )
              }}
              className="!h-10 !w-auto"
            >
              <option>All statuses</option>
              <option>In Stock</option>
              <option>Low Stock</option>
              <option>Out of Stock</option>
            </select>
          </label>
          <label className="field !mb-0 flex-row items-center gap-2">
            <span>Category</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="!h-10 !w-auto"
            >
              <option>All categories</option>
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex overflow-hidden rounded-md border border-[#e5ebf3] bg-white">
          {(["active", "archived"] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setRecordView(view)}
              className={`px-3 py-2 text-sm font-medium transition ${
                recordView === view
                  ? "bg-slate-800 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {view === "active" ? "Active" : "Archived"} (
              {view === "active"
                ? activeProducts.length
                : archivedProducts.length}
              )
            </button>
          ))}
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyText="No products found."
        footer={
          <span>
            {filtered.length} {filtered.length === 1 ? "product" : "products"}
          </span>
        }
      />
    </div>
  )
}
