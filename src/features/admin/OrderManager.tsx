import { useState, useEffect, type FormEvent } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { useLoad } from "@/hooks/useLoad";
import { formatDate, formatPrice } from "@/services/format";
import { createOrder, listOrders, orderStatuses, updateOrderStatus, clearAllOrders } from "@/services/orderService";
import { listProducts } from "@/services/productService";
import type { Notify, Order, Product } from "@/types";

export function OrderManager({ notify, canEdit }: { notify: Notify; canEdit: boolean }) {
  const orders = useLoad(listOrders, [] as Order[], notify, "orders");
  const products = useLoad(listProducts, [] as Product[], notify, "products");

  const [showForm, setShowForm] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);

  useEffect(() => {
    if (!orders.loading && orders.data.length >= 100) {
      const shouldExport = window.confirm(
        `⚠️ Customer Orders limit reached (${orders.data.length}/100 orders).\n\nIt is recommended to export or print your records before clearing the table. Would you like to open the print/export dialog now?`
      );
      if (shouldExport) {
        window.print();
      }
    }
  }, [orders.data.length, orders.loading]);

  // Auto-fill Unit Price when Product is selected
  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const foundProduct = products.data.find((p) => p.id === productId);
    if (foundProduct) {
      setUnitPrice(foundProduct.price);
    }
  };

  const calculatedTotal = quantity * unitPrice;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await createOrder({
        customerName: String(form.get("customerName") || "Walk-in Customer"),
        productId: selectedProductId || null,
        quantity: quantity,
        total: calculatedTotal,
      });
      notify("Order created successfully.");
      setShowForm(false);
      setSelectedProductId("");
      setQuantity(1);
      setUnitPrice(0);
      await orders.reload();
    } catch (error) {
      notify(`Could not create order: ${(error as Error).message}`);
    }
  };

  const changeStatus = async (order: Order, status: string) => {
    try {
      await updateOrderStatus(order.id, status);
      orders.setData((current) => current.map((o) => (o.id === order.id ? { ...o, status } : o)));
      notify("Order status updated.");
    } catch (error) {
      notify(`Could not update status: ${(error as Error).message}`);
    }
  };

  const handleClearTable = async () => {
    const confirmClear = window.confirm("Are you sure you want to clear ALL customer orders? This action cannot be undone.");
    if (!confirmClear) return;

    try {
      await clearAllOrders();
      notify("Order table cleared successfully.");
      await orders.reload();
    } catch (error) {
      notify(`Could not clear table: ${(error as Error).message}`);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold cursor-not-allowed opacity-90";
      case "Cancelled":
        return "bg-red-100 text-red-800 border-red-300 font-semibold cursor-not-allowed opacity-90";
      case "Processing":
        return "bg-blue-100 text-blue-800 border-blue-300 font-semibold";
      case "Pending":
      default:
        return "bg-amber-100 text-amber-800 border-amber-300 font-semibold";
    }
  };

  const rows = orders.data.map((o) => {
    const isLocked = o.status === "Completed" || o.status === "Cancelled";
    const statusStyle = `input !h-9 !w-40 !text-[13px] ${getStatusStyle(o.status)}`;

    return [
      o.orderNumber,
      o.customerName,
      o.productName ?? "—",
      o.quantity,
      formatPrice(o.total),
      formatDate(o.createdAt),
      <select
        value={o.status}
        disabled={isLocked}
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
    ];
  });

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="page-title">Customer Orders ({orders.data.length})</h1>
        
        <div className="flex gap-2 items-center">
          <button className="btn-secondary flex items-center gap-1" onClick={() => window.print()} title="Export / Print Records">
            Export
          </button>

          {canEdit && orders.data.length > 0 && (
            <button className="btn-danger bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 transition" onClick={handleClearTable}>
              Clear Table
            </button>
          )}

          {canEdit && (
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              <Icon name="plus" size={16} /> New Order
            </button>
          )}
        </div>
      </div>

      {showForm && canEdit && (
        <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-3">
          <label className="field">
            <span>Customer Name</span>
            <input name="customerName" placeholder="e.g. Walk-in Customer" />
          </label>

          <label className="field">
            <span>Product</span>
            <select
              value={selectedProductId}
              onChange={(e) => handleProductChange(e.target.value)}
              required
            >
              <option value="" disabled>Select product</option>
              {products.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatPrice(p.price)})
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
            <span>Total Amount</span>
            <input
              type="text"
              value={formatPrice(calculatedTotal)}
              readOnly
              className="bg-slate-100 font-bold text-emerald-700 cursor-not-allowed"
            />
          </label>

          <div className="sm:col-span-3">
            <button className="btn-primary" type="submit">Save Order</button>
          </div>
        </form>
      )}

      <DataTable
        columns={["Order #", "Customer", "Product", "Qty", "Total Amount", "Date", "Status"]}
        rows={rows}
        loading={orders.loading}
        emptyText="No customer orders yet."
      />
    </div>
  );
}