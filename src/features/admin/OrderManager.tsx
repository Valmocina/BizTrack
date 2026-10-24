import { useState, useEffect, type FormEvent } from "react"
import { DataTable } from "@/components/ui/DataTable"
import { Icon } from "@/components/ui/Icon"
import { useLoad } from "@/hooks/useLoad"
import { downloadExcel } from "@/services/excel"
import { formatDate, formatPrice } from "@/services/format"
import {
  archiveOrders,
  createOrder,
  deleteArchivedOrder,
  listOrders,
  orderStatuses,
  restoreOrders,
  updateOrderAssignee,
  updateOrderStatus,
} from "@/services/orderService"
import { listProducts } from "@/services/productService"
import { listProfiles } from "@/services/userService"
import type { Notify, Order, Product, Profile } from "@/types"

export function OrderManager({
  notify,
  canEdit,
  initialOrderNumber = "",
}: {
  notify: Notify
  canEdit: boolean
  initialOrderNumber?: string
}) {
  const orders = useLoad(listOrders, [] as Order[], notify, "orders")
  const products = useLoad(listProducts, [] as Product[], notify, "products")
  const profiles = useLoad(listProfiles, [] as Profile[], notify, "users")

  const [recordView, setRecordView] = useState<"active" | "archived">("active")
  const [statusFilter, setStatusFilter] = useState("All statuses")
  const [showForm, setShowForm] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string>("")
  const [quantity, setQuantity] = useState<number>(1)
  const [unitPrice, setUnitPrice] = useState<number>(0)
  const selectedProduct = products.data.find(
    (product) => product.id === selectedProductId && (product.isActive ?? true),
  )
  const remainingStock = selectedProduct
    ? selectedProduct.stock - quantity
    : null
  const activeOrders = orders.data.filter((order) => !order.isArchived)
  const archivedOrders = orders.data.filter((order) => order.isArchived)
  const visibleOrders = (
    recordView === "active" ? activeOrders : archivedOrders
  ).filter(
    (order) =>
      (statusFilter === "All statuses" || order.status === statusFilter) &&
      (!initialOrderNumber ||
        order.orderNumber.toLowerCase() === initialOrderNumber.toLowerCase()),
  )

  useEffect(() => {
    if (initialOrderNumber) {
      setRecordView("active")
      setStatusFilter("All statuses")
    }
  }, [initialOrderNumber])

  useEffect(() => {
    if (!orders.loading && activeOrders.length >= 100) {
      const shouldExport = window.confirm(
        `Customer Orders limit reached (${activeOrders.length}/100 active orders).\n\nIt is recommended to print or export your records before archiving them. Would you like to open the print dialog now?`,
      )
      if (shouldExport) {
        window.print()
      }
    }
  }, [activeOrders.length, orders.loading])

  // Auto-fill Unit Price when Product is selected
  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId)
    const foundProduct = products.data.find((p) => p.id === productId)
    if (foundProduct) {
      setUnitPrice(foundProduct.price)
    }
  }

  const changeAssignee = async (order: Order, assignedTo: string) => {
    const nextAssignee = assignedTo || null
    try {
      await updateOrderAssignee(order.id, nextAssignee)
      orders.setData((current) =>
        current.map((item) =>
          item.id === order.id ? { ...item, assignedTo: nextAssignee } : item,
        ),
      )
      notify(
        nextAssignee
          ? `Order ${order.orderNumber} assigned.`
          : `Order ${order.orderNumber} is now unassigned.`,
      )
    } catch (error) {
      notify(`Could not assign order: ${(error as Error).message}`)
    }
  }

  const getAssigneeLabel = (profile: Profile) =>
    profile.fullName
      ? `${profile.fullName} (${profile.email})`
      : `${profile.email}${profile.role === "admin" ? " - Admin" : ""}`

  const calculatedTotal = quantity * unitPrice

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      if (!selectedProductId) {
        notify("Select a product before saving the order.")
        return
      }
      const currentProducts = await listProducts()
      const currentProduct = currentProducts.find(
        (product) =>
          product.id === selectedProductId && (product.isActive ?? true),
      )
      if (!currentProduct) {
        notify(
          "This product is no longer available. Refresh the product selection.",
        )
        await products.reload()
        return
      }
      if (quantity > currentProduct.stock) {
        notify(
          `Only ${currentProduct.stock} ${currentProduct.name} available. Reduce the quantity before saving.`,
        )
        await products.reload()
        return
      }
      await createOrder({
        customerName: String(form.get("customerName") || "Walk-in Customer"),
        productId: selectedProductId || null,
        quantity: quantity,
        total: calculatedTotal,
        assignedTo: String(form.get("assignedTo") || "") || null,
      })
      notify("Order created successfully.")
      setShowForm(false)
      setSelectedProductId("")
      setQuantity(1)
      setUnitPrice(0)
      await orders.reload()
    } catch (error) {
      notify(`Could not create order: ${(error as Error).message}`)
    }
  }

  const changeStatus = async (order: Order, status: string) => {
    try {
      await updateOrderStatus(order.id, status)
      orders.setData((current) =>
        current.map((o) => (o.id === order.id ? { ...o, status } : o)),
      )
      notify("Order status updated.")
    } catch (error) {
      notify(`Could not update status: ${(error as Error).message}`)
    }
  }

  const handleArchive = async () => {
    if (
      !window.confirm(
        `Archive these ${visibleOrders.length} customer orders? You can restore them from the Archived tab.`,
      )
    )
      return

    try {
      await archiveOrders(visibleOrders.map((order) => order.id))
      notify("Customer orders archived.")
      await orders.reload()
    } catch (error) {
      notify(`Could not archive orders: ${(error as Error).message}`)
    }
  }

  const handleRestore = async () => {
    try {
      await restoreOrders(visibleOrders.map((order) => order.id))
      notify("Customer orders restored.")
      await orders.reload()
    } catch (error) {
      notify(`Could not restore orders: ${(error as Error).message}`)
    }
  }

  const handleArchiveOrder = async (order: Order) => {
    if (
      !window.confirm(
        `Archive order ${order.orderNumber}? You can restore it from the Archived tab.`,
      )
    )
      return
    try {
      await archiveOrders([order.id])
      await orders.reload()
      notify(`Order ${order.orderNumber} archived.`)
    } catch (error) {
      notify(`Could not archive order: ${(error as Error).message}`)
    }
  }

  const handleRestoreOrder = async (order: Order) => {
    try {
      await restoreOrders([order.id])
      await orders.reload()
      notify(`Order ${order.orderNumber} restored.`)
    } catch (error) {
      notify(`Could not restore order: ${(error as Error).message}`)
    }
  }

  const handleDeleteArchivedOrder = async (order: Order) => {
    if (
      !window.confirm(
        `Permanently delete archived order ${order.orderNumber}? This cannot be undone.`,
      )
    )
      return
    try {
      await deleteArchivedOrder(order.id)
      await orders.reload()
      notify(`Order ${order.orderNumber} permanently deleted.`)
    } catch (error) {
      notify(`Could not permanently delete order: ${(error as Error).message}`)
    }
  }

  const exportExcel = async () => {
    try {
      await downloadExcel("customer-orders.xlsx", "Customer Orders", [
        [
          "Order #",
          "Customer",
          "Product",
          "Qty",
          "Total Amount",
          "Date",
          ...(canEdit ? ["Assigned To"] : []),
          "Status",
        ],
        ...visibleOrders.map((order) => [
          order.orderNumber,
          order.customerName,
          order.productName ?? "—",
          String(order.quantity),
          formatPrice(order.total),
          formatDate(order.createdAt),
          order.status,
        ]),
      ])
    } catch (error) {
      notify(`Could not export customer orders: ${(error as Error).message}`)
    }
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold cursor-not-allowed opacity-90"
      case "Cancelled":
        return "bg-red-100 text-red-800 border-red-300 font-semibold cursor-not-allowed opacity-90"
      case "Processing":
        return "bg-blue-100 text-blue-800 border-blue-300 font-semibold"
      case "Pending":
      default:
        return "bg-amber-100 text-amber-800 border-amber-300 font-semibold"
    }
  }

  const rows = visibleOrders.map((o) => {
    const isLocked = o.status === "Completed" || o.status === "Cancelled"
    const statusStyle = `input !h-9 !w-40 !text-[13px] ${getStatusStyle(o.status)}`

    return [
      o.orderNumber,
      o.customerName,
      o.productName ?? "—",
      o.quantity,
      formatPrice(o.total),
      formatDate(o.createdAt),
      ...(canEdit
        ? [
            <select
              value={o.assignedTo ?? ""}
              disabled={o.isArchived || profiles.loading}
              onChange={(event) => changeAssignee(o, event.target.value)}
              className="input !h-9 !w-52 !py-0 text-sm"
              aria-label={`Assign order ${o.orderNumber}`}
            >
              <option value="">Unassigned (admin handling)</option>
              {profiles.data.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {getAssigneeLabel(profile)}
                </option>
              ))}
            </select>,
          ]
        : []),
      <select
        value={o.status}
        disabled={isLocked || o.isArchived}
        onChange={(e) => changeStatus(o, e.target.value)}
        className={statusStyle}
        key={`order-status-${o.id}`}
      >
        {orderStatuses.map((s) => (
          <option key={s} value={s} disabled={isLocked && s !== o.status}>
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
                o.isArchived ? handleRestoreOrder(o) : handleArchiveOrder(o)
              }
              aria-label={`${
                o.isArchived ? "Restore" : "Archive"
              } order ${o.orderNumber}`}
              title={`${
                o.isArchived ? "Restore" : "Archive"
              } order ${o.orderNumber}`}
            >
              <Icon name={o.isArchived ? "eye" : "eyeoff"} size={16} />
              {o.isArchived ? "Restore" : "Archive"}
            </button>,
            ...(o.isArchived
              ? [
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-rose-700 hover:text-rose-900"
                    onClick={() => handleDeleteArchivedOrder(o)}
                    aria-label={`Permanently delete order ${o.orderNumber}`}
                    title={`Permanently delete order ${o.orderNumber}`}
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
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="page-title">Customer Orders ({orders.data.length})</h1>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            className="btn-secondary flex items-center gap-1 print:hidden"
            onClick={() => window.print()}
            title="Print visible records"
          >
            Print
          </button>

          <button
            className="btn-secondary flex items-center gap-1 print:hidden"
            onClick={exportExcel}
            title="Download visible records as an Excel workbook"
          >
            Excel
          </button>

          {canEdit && recordView === "active" && visibleOrders.length > 0 && (
            <button
              className="btn-secondary print:hidden"
              onClick={handleArchive}
            >
              Archive ({visibleOrders.length})
            </button>
          )}

          {canEdit && recordView === "archived" && visibleOrders.length > 0 && (
            <button
              className="btn-secondary print:hidden"
              onClick={handleRestore}
            >
              Restore ({visibleOrders.length})
            </button>
          )}

          {canEdit && recordView === "active" && (
            <button
              className="btn-primary print:hidden"
              onClick={() => setShowForm(!showForm)}
            >
              <Icon name="plus" size={16} /> New Order
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
            {view === "active" ? activeOrders.length : archivedOrders.length})
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
            {orderStatuses.map((status) => (
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
            <span>Customer Name</span>
            <input name="customerName" placeholder="e.g. Walk-in Customer" />
          </label>

          {canEdit && (
            <label className="field">
              <span>Assign to user (optional)</span>
              <select name="assignedTo" defaultValue="">
                <option value="">Unassigned (admin handling)</option>
                {profiles.data.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {getAssigneeLabel(profile)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="field">
            <span>Product</span>
            <select
              value={selectedProductId}
              onChange={(e) => handleProductChange(e.target.value)}
              required
            >
              <option value="" disabled>
                Select product
              </option>
              {products.data
                .filter((product) => product.isActive ?? true)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.stock} in stock ({formatPrice(p.price)})
                  </option>
                ))}
            </select>
          </label>

          <label className="field">
            <span>Quantity to order</span>
            <input
              type="number"
              min="1"
              max={selectedProduct?.stock}
              value={quantity}
              onChange={(e) =>
                setQuantity(
                  Math.max(
                    1,
                    Math.min(
                      Number(e.target.value) || 1,
                      selectedProduct?.stock ?? Number.MAX_SAFE_INTEGER,
                    ),
                  ),
                )
              }
              disabled={!selectedProduct || selectedProduct.stock <= 0}
              aria-describedby="order-stock-availability"
              required
            />
          </label>

          <div
            id="order-stock-availability"
            className={`flex flex-col justify-center rounded-lg border px-4 py-3 text-sm ${
              !selectedProduct
                ? "border-slate-200 bg-slate-50 text-slate-600"
                : selectedProduct.stock <= 0
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : remainingStock !== null && remainingStock < 0
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
            role="status"
            aria-live="polite"
          >
            {selectedProduct ? (
              <>
                <span className="font-semibold">
                  {selectedProduct.stock} available in stock
                </span>
                <span className="mt-1">
                  {quantity} selected
                  {remainingStock !== null && remainingStock >= 0
                    ? ` · ${remainingStock} remaining`
                    : ""}
                </span>
              </>
            ) : (
              <span>Select a product to see stock availability.</span>
            )}
          </div>

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
            <span>Total Amount</span>
            <input
              type="text"
              value={formatPrice(calculatedTotal)}
              readOnly
              className="bg-slate-100 font-bold text-emerald-700 cursor-not-allowed"
            />
          </label>

          <div className="sm:col-span-3">
            <button className="btn-primary" type="submit">
              Save Order
            </button>
          </div>
        </form>
      )}

      <DataTable
        columns={[
          "Order #",
          "Customer",
          "Product",
          "Qty",
          "Total Amount",
          "Date",
          "Status",
          ...(canEdit ? ["Actions"] : []),
        ]}
        rows={rows}
        loading={orders.loading}
        emptyText={
          statusFilter === "All statuses"
            ? `No ${recordView} customer orders.`
            : `No ${recordView} orders with this status.`
        }
      />
    </div>
  )
}
