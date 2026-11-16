import { useState, useEffect, useRef, type FormEvent } from "react"
import { DataTable } from "@/components/ui/DataTable"
import { Icon } from "@/components/ui/Icon"
import { useLoad } from "@/hooks/useLoad"
import { downloadExcel } from "@/services/excel"
import { formatDate, formatPeso, formatPrice } from "@/services/format"
import {
  archivePurchaseOrders,
  createPurchaseOrder,
  deleteArchivedPurchaseOrder,
  listPurchaseReceipts,
  listPurchaseOrders,
  poStatuses,
  recordPurchaseReceipt,
  restorePurchaseOrders,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
} from "@/services/purchaseOrderService"
import { listSuppliers } from "@/services/supplierService"
import type { Notify, PurchaseOrder, PurchaseReceipt, Supplier } from "@/types"

export function PurchaseOrders({
  notify,
  canEdit,
  canCreate,
  canRecordReceipt,
  initialProductName,
}: {
  notify: Notify
  canEdit: boolean
  canCreate: boolean
  canRecordReceipt: boolean
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
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null)
  const [receivedNow, setReceivedNow] = useState("")
  const [receiptNotes, setReceiptNotes] = useState("")
  const [savingReceipt, setSavingReceipt] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 })
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null)
  const [detailView, setDetailView] = useState<"details" | "receipts">(
    "details",
  )
  const receiptHistoryRequest = useRef(0)
  const [receiptHistory, setReceiptHistory] = useState<PurchaseReceipt[]>([])
  const [loadingReceiptHistory, setLoadingReceiptHistory] = useState(false)
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null)
  const [editQuantity, setEditQuantity] = useState("")
  const [editExpectedDate, setEditExpectedDate] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
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
      const status = await createPurchaseOrder({
        supplierId: selectedSupplierId || null,
        productId: selectedProductId || null,
        quantity: quantity,
        expectedDate: String(form.get("expected") || "") || null,
      })
      notify(
        status === "Pending Approval"
          ? "Purchase request submitted for admin approval."
          : "Stock purchase recorded successfully.",
      )
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
      setActiveMenuId(null)
      await pos.reload()
      notify(
        status === "In transit"
          ? `Purchase ${po.poNumber} marked in transit.`
          : `Purchase ${po.poNumber} status updated.`,
      )
    } catch (error) {
      notify(`Could not update: ${(error as Error).message}`)
    }
  }

  const openOrder = async (
    order: PurchaseOrder,
    view: "details" | "receipts" = "details",
  ) => {
    const requestId = ++receiptHistoryRequest.current
    setViewingOrder(order)
    setDetailView(view)
    setReceiptHistory([])
    setLoadingReceiptHistory(true)
    setActiveMenuId(null)
    try {
      const history = await listPurchaseReceipts(order.id)
      if (requestId === receiptHistoryRequest.current) {
        setReceiptHistory(history)
      }
    } catch (error) {
      if (requestId === receiptHistoryRequest.current) {
        notify(`Could not load receipt history: ${(error as Error).message}`)
      }
    } finally {
      if (requestId === receiptHistoryRequest.current) {
        setLoadingReceiptHistory(false)
      }
    }
  }

  const openEditOrder = (order: PurchaseOrder) => {
    setEditingOrder(order)
    setEditQuantity(String(order.quantity))
    setEditExpectedDate(order.expectedDate ?? "")
    setActiveMenuId(null)
  }

  const submitEditOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingOrder) return

    const quantity = Number(editQuantity)
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity < editingOrder.receivedQuantity
    ) {
      notify(
        "Quantity must be a whole number and cannot be less than received.",
      )
      return
    }

    setSavingEdit(true)
    try {
      await updatePurchaseOrder(
        editingOrder.id,
        quantity,
        editExpectedDate || null,
      )
      setEditingOrder(null)
      await pos.reload()
      notify(`Purchase ${editingOrder.poNumber} updated.`)
    } catch (error) {
      notify(`Could not update purchase order: ${(error as Error).message}`)
    } finally {
      setSavingEdit(false)
    }
  }

  const cancelOrder = async (order: PurchaseOrder) => {
    if (
      !window.confirm(
        `Cancel purchase order ${order.poNumber}? This cannot be undone.`,
      )
    )
      return
    await changeStatus(order, "Cancelled")
  }

  const submitReceipt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!receiving) return

    const quantity = Number(receivedNow)
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > receiving.quantity - receiving.receivedQuantity
    ) {
      notify(
        "Enter a valid quantity that does not exceed the outstanding amount.",
      )
      return
    }

    setSavingReceipt(true)
    try {
      await recordPurchaseReceipt(receiving.id, quantity, receiptNotes.trim())
      notify(`${quantity} units received for purchase ${receiving.poNumber}.`)
      setReceiving(null)
      setReceivedNow("")
      setReceiptNotes("")
      await pos.reload()
    } catch (error) {
      notify(`Could not record receipt: ${(error as Error).message}`)
    } finally {
      setSavingReceipt(false)
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
    if (!["Received", "Cancelled"].includes(order.status)) {
      notify("Only received or cancelled purchase orders can be archived.")
      return
    }
    if (
      !window.confirm(
        `Archive purchase order ${order.poNumber}? You can restore it from the Archived tab.`,
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
          "Received",
          "Amount",
          "Expected Date",
          "Status",
        ],
        ...visiblePurchaseOrders.map((po) => [
          po.poNumber,
          po.supplierName,
          po.productName ?? "—",
          String(po.quantity),
          String(po.receivedQuantity),
          formatPeso(po.amount),
          formatDate(po.expectedDate),
          po.status,
        ]),
      ])
    } catch (error) {
      notify(`Could not export purchase stock: ${(error as Error).message}`)
    }
  }

  const rows = visiblePurchaseOrders.map((p) => {
    const isReceived = p.status === "Received"
    const isCancelled = p.status === "Cancelled"
    const isTerminal = isReceived || isCancelled
    const canReceive =
      canRecordReceipt &&
      Boolean(p.productId) &&
      p.receivedQuantity < p.quantity &&
      ["In transit", "Partially Received"].includes(p.status)
    const canEditOrder =
      canEdit &&
      !p.isArchived &&
      ["Pending", "Pending Approval", "Approved"].includes(p.status) &&
      p.receivedQuantity === 0
    const canMarkInTransit =
      !p.isArchived &&
      ["Pending", "Approved"].includes(p.status) &&
      (p.amount <= 10000 || p.status === "Approved")
    const canCancel =
      canEdit &&
      !p.isArchived &&
      ["Pending", "Pending Approval", "Approved", "In transit"].includes(
        p.status,
      )
    const statusTone = isReceived
      ? "bg-emerald-100 text-emerald-800"
      : p.status === "Cancelled" || p.status === "Rejected"
        ? "bg-red-100 text-red-800"
        : p.status === "Pending Approval"
          ? "bg-orange-100 text-orange-800"
          : p.status === "In transit"
            ? "bg-blue-100 text-blue-800"
            : p.status === "Partially Received"
              ? "bg-violet-100 text-violet-800"
              : "bg-amber-100 text-amber-800"

    return [
      p.poNumber,
      p.supplierName,
      p.productName ?? "—",
      p.quantity,
      `${p.receivedQuantity} / ${p.quantity}`,
      formatPeso(p.amount),
      formatDate(p.expectedDate),
      <span
        key={`status-${p.id}`}
        className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${statusTone}`}
      >
        {p.status}
      </span>,
      <div className="flex items-center justify-end gap-2">
        {canReceive && !p.isArchived && (
          <button
            type="button"
            className="btn-secondary !h-9 !px-3 text-xs"
            onClick={() => {
              setReceiving(p)
              setReceivedNow("")
              setReceiptNotes("")
            }}
          >
            Record Receipt
          </button>
        )}
        <button
          type="button"
          className="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label={`Actions for purchase order ${p.poNumber}`}
          aria-expanded={activeMenuId === p.id}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            setMenuPosition({
              top: Math.max(
                8,
                Math.min(rect.bottom + 6, window.innerHeight - 260),
              ),
              right: window.innerWidth - rect.right,
            })
            setActiveMenuId(activeMenuId === p.id ? null : p.id)
          }}
        >
          <Icon name="more" size={18} />
        </button>
        {activeMenuId === p.id && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="Close actions menu"
              onClick={() => setActiveMenuId(null)}
            />
            <div
              role="menu"
              className="fixed z-50 max-h-[calc(100vh-2rem)] w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
              style={{ top: menuPosition.top, right: menuPosition.right }}
            >
              <button
                type="button"
                role="menuitem"
                className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => void openOrder(p)}
              >
                View Details
              </button>
              {isReceived && (
                <button
                  type="button"
                  role="menuitem"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => void openOrder(p, "receipts")}
                >
                  View Receipt History
                </button>
              )}
              {canEditOrder && (
                <button
                  type="button"
                  role="menuitem"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => openEditOrder(p)}
                >
                  Edit Purchase Order
                </button>
              )}
              {canMarkInTransit && (
                <button
                  type="button"
                  role="menuitem"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => void changeStatus(p, "In transit")}
                >
                  Mark In Transit
                </button>
              )}
              {canEdit && p.status === "Pending Approval" && !p.isArchived && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => void changeStatus(p, "Approved")}
                  >
                    Approve Purchase Order
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                    onClick={() => void changeStatus(p, "Rejected")}
                  >
                    Reject Purchase Order
                  </button>
                </>
              )}
              {canCancel && (
                <button
                  type="button"
                  role="menuitem"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                  onClick={() => void cancelOrder(p)}
                >
                  Cancel Purchase Order
                </button>
              )}
              {canEdit && !p.isArchived && isTerminal && (
                <button
                  type="button"
                  role="menuitem"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => handleArchiveOrder(p)}
                >
                  Archive
                </button>
              )}
              {canEdit && p.isArchived && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => handleRestoreOrder(p)}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                    onClick={() => handleDeleteArchivedOrder(p)}
                  >
                    Permanently Delete
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>,
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
            recordView === "archived" &&
            visiblePurchaseOrders.length > 0 && (
              <button className="btn-secondary" onClick={handleRestore}>
                Restore ({visiblePurchaseOrders.length})
              </button>
            )}

          {canCreate && recordView === "active" && (
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

      {showForm && canCreate && recordView === "active" && (
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
              value={formatPeso(unitPrice)}
              readOnly
              className="bg-slate-100 cursor-not-allowed font-medium"
            />
          </label>

          <label className="field">
            <span>Calculated Total</span>
            <input
              type="text"
              value={formatPeso(Number(calculatedTotal))}
              readOnly
              className="bg-slate-100 font-bold text-emerald-700 cursor-not-allowed"
            />
          </label>

          <p className="sm:col-span-3 text-sm text-slate-600">
            Purchases over ₱10,000 require Admin approval.
          </p>

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

      {receiving && (
        <form
          onSubmit={submitReceipt}
          className="card flex flex-wrap items-end gap-4 p-5 print:hidden"
        >
          <div className="mr-auto">
            <h2 className="font-semibold text-slate-800">
              Record receipt for {receiving.poNumber}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {receiving.receivedQuantity} of {receiving.quantity} units
              received. {receiving.quantity - receiving.receivedQuantity}{" "}
              remaining.
            </p>
          </div>
          <label className="field !mb-0">
            <span>Quantity received now</span>
            <input
              type="number"
              min="1"
              max={receiving.quantity - receiving.receivedQuantity}
              value={receivedNow}
              onChange={(event) => setReceivedNow(event.target.value)}
              required
            />
          </label>
          <label className="field !mb-0 min-w-56 flex-1">
            <span>Notes or discrepancies (optional)</span>
            <input
              type="text"
              maxLength={500}
              value={receiptNotes}
              onChange={(event) => setReceiptNotes(event.target.value)}
              placeholder="Condition, short shipment, etc."
            />
          </label>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setReceiving(null)
              setReceiptNotes("")
            }}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            type="submit"
            disabled={savingReceipt}
          >
            {savingReceipt ? "Saving..." : "Record Receipt"}
          </button>
        </form>
      )}

      <DataTable
        columns={[
          "Order #",
          "Supplier",
          "Product",
          "Qty",
          "Received",
          "Amount",
          "Expected Date",
          "Status",
          "Actions",
        ]}
        rows={rows}
        loading={pos.loading}
        emptyText={
          statusFilter === "All statuses"
            ? `No ${recordView} purchase stock records.`
            : `No ${recordView} records with this status.`
        }
      />

      {viewingOrder && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 print:hidden"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setViewingOrder(null)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="purchase-order-details-title"
            className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="purchase-order-details-title"
                  className="text-xl font-bold text-slate-900"
                >
                  {detailView === "receipts"
                    ? `Receipt History · ${viewingOrder.poNumber}`
                    : `Purchase Order · ${viewingOrder.poNumber}`}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {viewingOrder.supplierName} · {viewingOrder.productName}
                </p>
              </div>
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                aria-label="Close purchase order details"
                onClick={() => setViewingOrder(null)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {detailView === "details" && (
              <dl className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">
                    Status
                  </dt>
                  <dd className="mt-1 font-medium text-slate-800">
                    {viewingOrder.status}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">
                    Amount
                  </dt>
                  <dd className="mt-1 font-medium text-slate-800">
                    {formatPeso(viewingOrder.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">
                    Quantity received
                  </dt>
                  <dd className="mt-1 font-medium text-slate-800">
                    {viewingOrder.receivedQuantity} / {viewingOrder.quantity}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">
                    Expected date
                  </dt>
                  <dd className="mt-1 font-medium text-slate-800">
                    {formatDate(viewingOrder.expectedDate)}
                  </dd>
                </div>
              </dl>
            )}

            <div className="mt-6">
              <h3 className="font-semibold text-slate-800">Receipt history</h3>
              {loadingReceiptHistory ? (
                <p className="mt-3 text-sm text-slate-500">
                  Loading receipt history...
                </p>
              ) : receiptHistory.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No receipts have been recorded for this order.
                </p>
              ) : (
                <ol className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200">
                  {receiptHistory.map((receipt) => (
                    <li key={receipt.id} className="space-y-2 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-semibold text-slate-800">
                          {receipt.quantity} units received
                        </span>
                        <time
                          className="text-xs text-slate-500"
                          dateTime={receipt.receivedAt}
                        >
                          {new Date(receipt.receivedAt).toLocaleString()}
                        </time>
                      </div>
                      <p className="text-sm text-slate-600">
                        Recorded by {receipt.receivedByName} ·{" "}
                        {receipt.remainingQuantity} remaining
                      </p>
                      {receipt.notes && (
                        <p className="text-sm text-slate-700">
                          {receipt.notes}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </div>
      )}

      {editingOrder && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 print:hidden"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditingOrder(null)
          }}
        >
          <form
            onSubmit={submitEditOrder}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-purchase-order-title"
            className="card w-full max-w-lg space-y-4 p-6"
          >
            <div>
              <h2
                id="edit-purchase-order-title"
                className="text-xl font-bold text-slate-900"
              >
                Edit Purchase Order
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {editingOrder.poNumber} · {editingOrder.supplierName} ·{" "}
                {editingOrder.productName}
              </p>
            </div>
            <label className="field">
              <span>Order quantity</span>
              <input
                type="number"
                min={Math.max(1, editingOrder.receivedQuantity)}
                step="1"
                value={editQuantity}
                onChange={(event) => setEditQuantity(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Expected date</span>
              <input
                type="date"
                value={editExpectedDate}
                onChange={(event) => setEditExpectedDate(event.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEditingOrder(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={savingEdit}
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
