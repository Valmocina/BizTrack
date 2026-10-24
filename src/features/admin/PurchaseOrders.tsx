import { useState, useEffect, type FormEvent } from "react"
import { DataTable } from "@/components/ui/DataTable"
import { Icon } from "@/components/ui/Icon"
import { useLoad } from "@/hooks/useLoad"
import { downloadExcel } from "@/services/excel"
import { formatDate, formatPrice } from "@/services/format"
import {
  archivePurchaseOrders,
  createPurchaseOrder,
  deleteArchivedPurchaseOrder,
  listPurchaseOrders,
  poStatuses,
  restorePurchaseOrders,
  updatePurchaseOrderStatus,
} from "@/services/purchaseOrderService"
import { listSuppliers } from "@/services/supplierService"
import type { Notify, PurchaseOrder, Supplier } from "@/types"

export function PurchaseOrders({
  notify,
  canEdit,
  initialProductName,
}: {
  notify: Notify
  canEdit: boolean
  initialProductName?: string
}) {
  const pos = useLoad(
    listPurchaseOrders,
    [] as PurchaseOrder[],
    notify,
    "purchase stock",
  )
  const suppliers = useLoad(
    listSuppliers,
    [] as Supplier[],
    notify,
    "suppliers",
  )

  const [recordView, setRecordView] = useState<"active" | "archived">("active")
  const [statusFilter, setStatusFilter] = useState("All statuses")
  const [showForm, setShowForm] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("")
  const [selectedProductId, setSelectedProductId] = useState<string>("")
  const [quantity, setQuantity] = useState<number>(1)
  const [unitPrice, setUnitPrice] = useState<number>(0)
  const activePurchaseOrders = pos.data.filter((po) => !po.isArchived)
  const archivedPurchaseOrders = pos.data.filter((po) => po.isArchived)
  const visiblePurchaseOrders = (
    recordView === "active" ? activePurchaseOrders : archivedPurchaseOrders
  ).filter(
    (po) => statusFilter === "All statuses" || po.status === statusFilter,
  )

  // Safely auto-fill supplier and product selection when redirected from Reorder button
  useEffect(() => {
    if (!initialProductName || suppliers.loading || suppliers.data.length === 0)
      return

    for (const supplier of suppliers.data) {
      const match = supplier.products?.find(
        (p) =>
          p.productName &&
          (initialProductName
            .toLowerCase()
            .includes(p.productName.toLowerCase()) ||
            p.productName
              .toLowerCase()
              .includes(initialProductName.toLowerCase())),
      )

      if (match) {
        setShowForm(true)
        setSelectedSupplierId(supplier.id)
        setSelectedProductId(match.productId || "")
        setUnitPrice(match.unitPrice || 0)
        break
      }
    }
  }, [initialProductName, suppliers.data, suppliers.loading])

  useEffect(() => {
    if (!pos.loading && activePurchaseOrders.length >= 100) {
      const shouldExport = window.confirm(
        `Purchase Stock limit reached (${activePurchaseOrders.length}/100 active records).\n\nIt is recommended to print or export your records before archiving them. Would you like to open the print dialog now?`,
      )
      if (shouldExport) {
        window.print()
      }
    }
  }, [activePurchaseOrders.length, pos.loading])

  // Find currently selected supplier object
  const selectedSupplier = suppliers.data.find(
    (s) => s.id === selectedSupplierId,
  )

  // Filter available products based on selected supplier's offered products array
  const availableProducts = selectedSupplier?.products || []

  // Handle supplier selection
  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId)
    setSelectedProductId("")
    setUnitPrice(0)
  }

  // Handle product selection
  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId)
    const matchedItem = availableProducts.find((p) => p.productId === productId)
    if (matchedItem) {
      setUnitPrice(matchedItem.unitPrice)
    }
  }

  const calculatedTotal = (quantity * unitPrice).toFixed(2)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await createPurchaseOrder({
        supplierId: selectedSupplierId || null,
        productId: selectedProductId || null,
        quantity: quantity,
        amount: Number(calculatedTotal),
        expectedDate: String(form.get("expected") || "") || null,
      })
      notify("Stock purchase recorded successfully.")
      setShowForm(false)
      setSelectedSupplierId("")
      setSelectedProductId("")
      setQuantity(1)
      setUnitPrice(0)
      await pos.reload()
    } catch (error) {
      notify(`Could not save: ${(error as Error).message}`)
    }
  }

  const changeStatus = async (po: PurchaseOrder, status: string) => {
    try {
      await updatePurchaseOrderStatus(po.id, status)
      pos.setData((current) =>
        current.map((p) => (p.id === po.id ? { ...p, status } : p)),
      )
      notify("Status updated.")
    } catch (error) {
      notify(`Could not update: ${(error as Error).message}`)
    }
  }

  const handleArchive = async () => {
    if (
      !window.confirm(
        `Archive these ${visiblePurchaseOrders.length} purchase stock records? You can restore them from the Archived tab.`,
      )
    )
      return

    try {
      await archivePurchaseOrders(visiblePurchaseOrders.map((po) => po.id))
      notify("Purchase stock records archived.")
      await pos.reload()
    } catch (error) {
      notify(`Could not archive purchase stock: ${(error as Error).message}`)
    }
  }

  const handleRestore = async () => {
    try {
      await restorePurchaseOrders(visiblePurchaseOrders.map((po) => po.id))
      notify("Purchase stock records restored.")
      await pos.reload()
    } catch (error) {
      notify(`Could not restore purchase stock: ${(error as Error).message}`)
    }
  }

  const handleArchiveOrder = async (order: PurchaseOrder) => {
    if (
      !window.confirm(
        `Archive purchase stock record ${order.poNumber}? You can restore it from the Archived tab.`,
      )
    )
      return
    try {
      await archivePurchaseOrders([order.id])
      await pos.reload()
      notify(`Purchase stock record ${order.poNumber} archived.`)
    } catch (error) {
      notify(`Could not archive purchase stock: ${(error as Error).message}`)
    }
  }

  const handleRestoreOrder = async (order: PurchaseOrder) => {
    try {
      await restorePurchaseOrders([order.id])
      await pos.reload()
      notify(`Purchase stock record ${order.poNumber} restored.`)
    } catch (error) {
      notify(`Could not restore purchase stock: ${(error as Error).message}`)
    }
  }

  const handleDeleteArchivedOrder = async (order: PurchaseOrder) => {
    if (
      !window.confirm(
        `Permanently delete archived purchase stock record ${order.poNumber}? This cannot be undone.`,
      )
    )
      return
    try {
      await deleteArchivedPurchaseOrder(order.id)
      await pos.reload()
      notify(`Purchase stock record ${order.poNumber} permanently deleted.`)
    } catch (error) {
      notify(
        `Could not permanently delete purchase stock: ${(error as Error).message}`,
      )
    }
  }

  const exportExcel = async () => {
    try {
      await downloadExcel("purchase-stock.xlsx", "Purchase Stock", [
        [
          "Order #",
          "Supplier",
          "Product",
          "Qty",
          "Amount",
          "Expected Date",
          "Status",
        ],
        ...visiblePurchaseOrders.map((po) => [
          po.poNumber,
          po.supplierName,
          po.productName ?? "—",
          String(po.quantity),
          formatPrice(po.amount),
          formatDate(po.expectedDate),
          po.status,
        ]),
      ])
    } catch (error) {
      notify(`Could not export purchase stock: ${(error as Error).message}`)
    }
  }

  const rows = visiblePurchaseOrders.map((p) => {
    const isLocked = p.status === "Received" || p.status === "Cancelled"

    let statusStyle = "input !h-9 !w-40 !text-[13px] font-medium"
    if (p.status === "Received") {
      statusStyle +=
        " bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold cursor-not-allowed opacity-90"
    } else if (p.status === "Cancelled") {
      statusStyle +=
        " bg-red-100 text-red-800 border-red-300 font-semibold cursor-not-allowed opacity-90"
    } else if (p.status === "In transit") {
      statusStyle += " bg-blue-100 text-blue-800 border-blue-300 font-semibold"
    } else {
      statusStyle +=
        " bg-amber-100 text-amber-800 border-amber-300 font-semibold"
    }

    return [
      p.poNumber,
      p.supplierName,
      p.productName ?? "—",
      p.quantity,
      formatPrice(p.amount),
      formatDate(p.expectedDate),
      <select
        value={p.status}
        disabled={isLocked || p.isArchived}
        onChange={(e) => changeStatus(p, e.target.value)}
        className={statusStyle}
        key={`status-${p.id}`}
      >
        {poStatuses.map((s) => (
          <option key={s} value={s} disabled={isLocked && s !== p.status}>
            {s}
          </option>
        ))}
      </select>,
      ...(canEdit
        ? [
            <button
              type="button"
              className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900"
              onClick={() =>
                p.isArchived ? handleRestoreOrder(p) : handleArchiveOrder(p)
              }
              aria-label={`${
                p.isArchived ? "Restore" : "Archive"
              } purchase stock record ${p.poNumber}`}
              title={`${
                p.isArchived ? "Restore" : "Archive"
              } purchase stock record ${p.poNumber}`}
            >
              <Icon name={p.isArchived ? "eye" : "eyeoff"} size={16} />
              {p.isArchived ? "Restore" : "Archive"}
            </button>,
            ...(p.isArchived
              ? [
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-rose-700 hover:text-rose-900"
                    onClick={() => handleDeleteArchivedOrder(p)}
                    aria-label={`Permanently delete purchase stock record ${p.poNumber}`}
                    title={`Permanently delete purchase stock record ${p.poNumber}`}
                  >
                    <Icon name="trash" size={16} />
                    Delete
                  </button>,
                ]
              : []),
          ]
        : []),
    ]
  })

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="page-title">Purchase Stock ({pos.data.length})</h1>

        <div className="flex flex-wrap gap-2 items-center print:hidden">
          <button
            className="btn-secondary flex items-center gap-1"
            onClick={() => window.print()}
            title="Print visible records"
          >
            Print
          </button>

          <button
            className="btn-secondary flex items-center gap-1"
            onClick={exportExcel}
            title="Download visible records as an Excel workbook"
          >
            Excel
          </button>

          {canEdit &&
            recordView === "active" &&
            visiblePurchaseOrders.length > 0 && (
              <button className="btn-secondary" onClick={handleArchive}>
                Archive ({visiblePurchaseOrders.length})
              </button>
            )}

          {canEdit &&
            recordView === "archived" &&
            visiblePurchaseOrders.length > 0 && (
              <button className="btn-secondary" onClick={handleRestore}>
                Restore ({visiblePurchaseOrders.length})
              </button>
            )}

          {canEdit && recordView === "active" && (
            <button
              className={`flex items-center gap-2 ${
                showForm
                  ? "btn-secondary !bg-red-50 !text-red-600 hover:!bg-red-100 border-red-200"
                  : "btn-primary"
              }`}
              onClick={() => setShowForm(!showForm)}
            >
              <Icon name={showForm ? "close" : "plus"} size={16} />
              {showForm ? "Cancel" : "Purchase Stock"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
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
              ? activePurchaseOrders.length
              : archivedPurchaseOrders.length}
            )
          </button>
        ))}
        <label className="field ml-auto !mb-0 flex-row items-center gap-2">
          <span className="whitespace-nowrap">Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="!h-10"
          >
            <option>All statuses</option>
            {poStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>

      {showForm && canEdit && recordView === "active" && (
        <form
          onSubmit={submit}
          className="card grid gap-4 p-5 print:hidden sm:grid-cols-3"
        >
          <label className="field">
            <span>Supplier</span>
            <select
              value={selectedSupplierId}
              onChange={(e) => handleSupplierChange(e.target.value)}
              required
            >
              <option value="" disabled>
                Select supplier
              </option>
              {suppliers.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Product</span>
            <select
              value={selectedProductId}
              onChange={(e) => handleProductChange(e.target.value)}
              required
              disabled={!selectedSupplierId || availableProducts.length === 0}
            >
              <option value="" disabled>
                {!selectedSupplierId
                  ? "Select a supplier first"
                  : availableProducts.length === 0
                    ? "No products assigned to supplier"
                    : "Select product"}
              </option>
              {availableProducts.map((sp) => (
                <option key={sp.productId} value={sp.productId}>
                  {sp.productName} ({formatPrice(sp.unitPrice)})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Quantity</span>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              required
            />
          </label>

          <label className="field">
            <span>Unit Price</span>
            <input
              type="text"
              value={formatPrice(unitPrice)}
              readOnly
              className="bg-slate-100 cursor-not-allowed font-medium"
            />
          </label>

          <label className="field">
            <span>Calculated Total</span>
            <input
              type="text"
              value={formatPrice(Number(calculatedTotal))}
              readOnly
              className="bg-slate-100 font-bold text-emerald-700 cursor-not-allowed"
            />
          </label>

          <label className="field">
            <span>Expected date</span>
            <input name="expected" type="date" />
          </label>

          <div className="sm:col-span-3 flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary !bg-red-50 !text-red-600 hover:!bg-red-100 border-red-200 !h-10 px-6"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
            <button className="btn-primary !h-10 px-6" type="submit">
              Save Stock Purchase
            </button>
          </div>
        </form>
      )}

      <DataTable
        columns={[
          "Order #",
          "Supplier",
          "Product",
          "Qty",
          "Amount",
          "Expected Date",
          "Status",
          ...(canEdit ? ["Actions"] : []),
        ]}
        rows={rows}
        loading={pos.loading}
        emptyText={
          statusFilter === "All statuses"
            ? `No ${recordView} purchase stock records.`
            : `No ${recordView} records with this status.`
        }
      />
    </div>
  )
}
