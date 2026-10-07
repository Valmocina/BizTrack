// Inventory Transactions: date range, CSV export and a form to record stock movements.
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { TransactionTable } from "@/components/TransactionTable";
import { useLoad } from "@/hooks/useLoad";
import { downloadCsv } from "@/services/csv";
import { createTransaction, listTransactions, clearInventoryTransactions } from "@/services/inventoryService";
import { listProducts } from "@/services/productService";
import type { InventoryTransaction, Notify, Product, TxType } from "@/types";

const ranges: Record<string, string> = { "7": "Last 7 days", "30": "Last 30 days", month: "This month", all: "All time" };

function rangeStart(range: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (range === "all") return null;
  if (range === "month") start.setDate(1);
  else start.setDate(start.getDate() - (Number(range) - 1));
  return start;
}

export function InventoryTransactions({ notify }: { notify: Notify }) {
  const tx = useLoad(listTransactions, [] as InventoryTransaction[], notify, "transactions");
  const products = useLoad(listProducts, [] as Product[], notify, "products");
  const [range, setRange] = useState("7");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const start = rangeStart(range);
  const visible = tx.data.filter((t) => !start || new Date(t.createdAt) >= start);
  const label = start ? `${start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} → ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : "All time";

  const exportCsv = () => {
    downloadCsv("inventory-transactions.csv", [["Date", "Product", "Type", "Quantity", "Reference", "Remarks"], ...visible.map((t) => [t.createdAt, t.productName, t.type, String(t.quantity), t.reference, t.remarks])]);
    notify("Transactions exported.");
  };

  const handleClearAll = async () => {
    if (tx.data.length === 0) return;

    if (!window.confirm("Are you sure you want to clear all inventory transaction history? This action cannot be undone.")) {
      return;
    }

    try {
      await clearInventoryTransactions();
      notify("Inventory transaction history cleared successfully.");
      await tx.reload();
    } catch (error) {
      notify(`Could not clear transactions: ${(error as Error).message}`);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    setSaving(true);
    try {
      await createTransaction({ productId: text("product"), type: text("type") as TxType, quantity: Number(text("quantity")), reference: text("reference"), remarks: text("remarks") });
      notify("Movement recorded and stock updated.");
      setShowForm(false);
      await tx.reload();
    } catch (error) {
      notify(`Could not save: ${(error as Error).message}`);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <h1 className="page-title">Inventory Transactions</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex h-10 items-center gap-2.5 rounded-md bg-white px-3.5 text-sm text-slate-700"><Icon name="calendar" size={16} className="text-slate-400" />{label}</span>
        <div className="flex items-center gap-3">
          <select value={range} onChange={(e) => setRange(e.target.value)} className="input !h-10 !w-auto" aria-label="Date range">
            {Object.entries(ranges).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
          <button className="btn-secondary !h-10" onClick={() => setShowForm(!showForm)}><Icon name="plus" size={16} /> Record movement</button>
          <button className="btn-primary !h-10" onClick={exportCsv}>Export</button>
          
          {tx.data.length > 0 && (
            <button
              type="button"
              className="btn-secondary !h-10 !bg-red-50 !text-red-600 hover:!bg-red-100 border-red-200 flex items-center gap-1.5"
              onClick={handleClearAll}
              title="Clear all transaction history"
            >
              <Icon name="trash" size={16} /> Clear History
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <label className="field"><span>Product</span><select name="product" required defaultValue=""><option value="" disabled>Select product</option>{products.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="field"><span>Type</span><select name="type" defaultValue="IN"><option value="IN">IN (add stock)</option><option value="OUT">OUT (remove stock)</option><option value="ADJUST">ADJUST (set stock to quantity)</option></select></label>
          <label className="field"><span>Quantity</span><input name="quantity" required type="number" min="0" placeholder="0" /></label>
          <label className="field"><span>Reference</span><input name="reference" placeholder="e.g. PO-102" /></label>
          <label className="field"><span>Remarks</span><input name="remarks" placeholder="Optional" /></label>
          <div className="sm:col-span-2 lg:col-span-5"><button className="btn-primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save movement"}</button></div>
        </form>
      )}

      <TransactionTable transactions={visible} loading={tx.loading} />
    </div>
  );
}