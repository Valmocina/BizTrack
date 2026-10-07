import { useState } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { useLoad } from "@/hooks/useLoad";
import { formatPrice } from "@/services/format";
import { categoryTone, deleteProduct, listProducts, stockStatus } from "@/services/productService";
import type { Notify, Product, StockStatus } from "@/types";

const statusTone: Record<StockStatus, "green" | "red" | "gray"> = { "In Stock": "green", "Low Stock": "red", "Out of Stock": "gray" };

export function ProductTable({ notify, canEdit, initialQuery, onAdd, onEdit }: {
  notify: Notify; canEdit: boolean; initialQuery: string; onAdd: () => void; onEdit: (product: Product) => void;
}) {
  const { data: items, setData: setItems, loading } = useLoad(listProducts, [] as Product[], notify, "products");
  const [query, setQuery] = useState(initialQuery);

  const filtered = items.filter((p) => `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(query.toLowerCase()));

  const remove = async (product: Product) => {
    if (!window.confirm(`Delete ${product.name}? This cannot be undone.`)) return;
    try {
      await deleteProduct(product.id);
      setItems((current) => current.filter((p) => p.id !== product.id));
      notify(`${product.name} was deleted.`);
    } catch (error) {
      notify(`Could not delete: ${(error as Error).message}`);
    }
  };

  const columns = ["ID", "Name", "Category", "Selling Price", "Supplier Cost", "Profit Margin", "Stock", "Status", ...(canEdit ? ["Actions"] : [])];
  
  const rows = filtered.map((p) => {
    const status = stockStatus(p);
    const cost = p.cost || 0;
    const price = p.price || 0;
    const profit = price - cost;
    const margin = price > 0 ? ((profit / price) * 100).toFixed(1) : "0.0";

    return [
      p.sku,
      p.name,
      p.category ? <span className={`rounded px-2 py-1 text-[11px] font-bold ${categoryTone(p.category)}`}>{p.category}</span> : "—",
      formatPrice(price),
      cost > 0 ? formatPrice(cost) : <span className="text-slate-400 italic">No link</span>,
      cost > 0 ? (
        <span className={`font-semibold ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
          {formatPrice(profit)} ({margin}%)
        </span>
      ) : (
        <span className="text-slate-400">—</span>
      ),
      p.stock,
      <Pill tone={statusTone[status]}>{status === "In Stock" && <span className="h-2 w-2 rounded-full border border-current" />}{status}</Pill>,
      ...(canEdit ? [
        <div className="flex gap-3 text-slate-400">
          <button onClick={() => onEdit(p)} className="hover:text-blue-600" aria-label={`Edit ${p.name}`}><Icon name="edit" size={18} /></button>
          <button onClick={() => remove(p)} className="hover:text-rose-600" aria-label={`Delete ${p.name}`}><Icon name="trash" size={18} /></button>
        </div>,
      ] : []),
    ];
  });

  return (
    <div className="space-y-5">
      <h1 className="page-title">Products</h1>
      <div className="flex items-center justify-between gap-4">
        <label className="flex h-11 w-full max-w-[350px] items-center gap-3 rounded-md border border-[#e5ebf3] bg-white px-3.5 text-slate-400">
          <Icon name="search" size={18} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" placeholder="Search products..." />
        </label>
        {canEdit && <button className="btn-primary" onClick={onAdd}><Icon name="plus" size={16} /> Add Product</button>}
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} emptyText="No products found." footer={<span>{filtered.length} {filtered.length === 1 ? "product" : "products"}</span>} />
    </div>
  );
}