import { supabase } from "@/services/supabaseClient";
import type { Product, ProductInput, StockStatus } from "@/types";

type ProductRow = {
  id: string; sku: string; name: string; category: string | null; description: string | null;
  price: number | string; stock: number; low_stock_alert: number; created_at: string;
  supplier_products?: { unit_price: number; suppliers?: { name: string } }[];
};

const toProduct = (row: ProductRow): Product => {
  const supplierLinks = row.supplier_products || [];
  
  // Get lowest supplier unit cost (if linked to multiple suppliers)
  let cost = 0;
  let supplierName = "Unlinked";

  if (supplierLinks.length > 0) {
    const validPrices = supplierLinks.map((sp) => Number(sp.unit_price || 0));
    cost = Math.min(...validPrices);
    const primarySupplier = supplierLinks[0]?.suppliers;
    if (primarySupplier && typeof primarySupplier === "object" && "name" in primarySupplier) {
      supplierName = (primarySupplier as { name: string }).name;
    }
  }

  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category ?? "",
    description: row.description ?? "",
    price: Number(row.price),
    cost,
    supplierName,
    stock: row.stock,
    lowStockAlert: row.low_stock_alert,
    createdAt: row.created_at,
  };
};



export async function listProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(`
      *,
      supplier_products (
        unit_price,
        suppliers ( name )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as unknown as ProductRow[]).map(toProduct);
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: input.name,
      category: input.category || null,
      description: input.description || null,
      price: input.price,
      stock: input.stock ?? 0,
      low_stock_alert: input.lowStockAlert ?? 10,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return toProduct(data);
}

export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  const { error } = await supabase.from("products").update({
    name: input.name,
    category: input.category || null,
    description: input.description || null,
    price: input.price,
    stock: input.stock,
    low_stock_alert: input.lowStockAlert,
  }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function stockStatus(product: Product): StockStatus {
  if (product.stock <= 0) return "Out of Stock";
  if (product.stock <= product.lowStockAlert) return "Low Stock";
  return "In Stock";
}

const categoryTones = ["bg-[#ffeacc] text-[#f0971c]", "bg-[#ffe0e4] text-[#ee4a5a]", "bg-[#dbeafe] text-[#2563eb]", "bg-[#d6f5e5] text-[#16a36b]", "bg-[#ece4ff] text-[#7c4dff]"];
export const categoryTone = (category: string) => categoryTones[[...category].reduce((sum, c) => sum + c.charCodeAt(0), 0) % categoryTones.length];