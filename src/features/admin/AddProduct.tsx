// Add / edit product form. Saves to the Supabase `products` table. The image box is a blank placeholder for now.
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { createProduct, updateProduct } from "@/services/productService";
import type { Notify, Product } from "@/types";

export function AddProduct({ product, notify, goTo }: { product: Product | null; notify: Notify; goTo: (page: string) => void }) {
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const input = {
      name: text("name"),
      category: text("category"),
      description: text("description"),
      price: Number(text("price")),
      stock: Number(text("stock")),
      lowStockAlert: Number(text("lowStockAlert") || 10),
    };
    setSaving(true);
    try {
      if (product) await updateProduct(product.id, input);
      else await createProduct(input);
      notify(product ? "Product updated." : "Product saved successfully.");
      goTo("Products");
    } catch (error) {
      notify(`Could not save product: ${(error as Error).message}`);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="page-title">{product ? "Edit Product" : "Add Product"}</h1>
      <form key={product?.id ?? "new"} onSubmit={submit} className="card p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_310px]">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="field sm:col-span-2"><span>Product Name <b className="text-rose-500">*</b></span><input name="name" required defaultValue={product?.name} placeholder="Ex: dried groundnut roasted." /></label>
            <label className="field"><span>Price <b className="text-rose-500">*</b></span><input name="price" required type="number" min="0" step=".01" defaultValue={product?.price} placeholder="Enter price" /></label>
            <label className="field"><span>Quantity in Stock <b className="text-rose-500">*</b></span><input name="stock" required type="number" min="0" defaultValue={product?.stock} placeholder="Enter quantity" /></label>
            <label className="field"><span>Category <b className="text-rose-500">*</b></span><input name="category" required defaultValue={product?.category} placeholder="Enter category" /></label>
            <label className="field"><span>Reorder Level</span><input name="lowStockAlert" type="number" min="0" defaultValue={product?.lowStockAlert} placeholder="Enter reorder level" /></label>
            <label className="field sm:col-span-2"><span>Description <b className="text-rose-500">*</b></span><textarea name="description" required rows={5} defaultValue={product?.description} placeholder="Enter product description" /></label>
          </div>
          <div>
            <p className="mb-2 text-sm text-slate-700">Image (optional)</p>
            {/* Blank placeholder: image upload is not connected yet */}
            <div className="flex h-[218px] cursor-not-allowed flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-[#f4f7fb] text-center" aria-disabled="true">
              <Icon name="image" size={30} className="mb-3 text-slate-400" />
              <p className="text-sm font-bold text-slate-700">Upload Image</p>
              <p className="mt-1 text-xs text-slate-400">Click to upload or drag and drop</p>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-secondary !bg-[#f4f7fb]" onClick={() => goTo("Products")}>Cancel</button>
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save Product"}</button>
        </div>
      </form>
    </div>
  );
}
