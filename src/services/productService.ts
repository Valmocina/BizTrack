import { supabase } from "@/services/supabaseClient"
import type { Product, ProductInput, StockStatus } from "@/types"

type ProductRow = {
  id: string
  sku: string
  name: string
  category: string | null
  description: string | null
  price: number | string
  stock: number
  low_stock_alert: number
  is_active?: boolean | null
  created_at: string
  supplier_products?: Array<{
    unit_price: number
    suppliers?: { name: string }
  }>
}

const toProduct = (row: ProductRow): Product => {
  const supplierLinks = row.supplier_products || []

  // Get lowest supplier unit cost (if linked to multiple suppliers)
  let cost = 0
  let supplierName = "Unlinked"

  if (supplierLinks.length > 0) {
    const validPrices = supplierLinks.map((sp) => Number(sp.unit_price || 0))
    cost = Math.min(...validPrices)
    const primarySupplier = supplierLinks[0]?.suppliers
    if (
      primarySupplier &&
      typeof primarySupplier === "object" &&
      "name" in primarySupplier
    ) {
      supplierName = (primarySupplier as { name: string }).name
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
    hasSupplier: supplierLinks.length > 0,
    stock: row.stock,
    lowStockAlert: row.low_stock_alert,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
  }
}

export async function setProductActive(
  id: string,
  isActive: boolean,
): Promise<void> {
  await setProductsActive([id], isActive)
}

export async function setProductsActive(
  ids: string[],
  isActive: boolean,
): Promise<void> {
  if (ids.length === 0) return

  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .in("id", ids)
  if (error) throw new Error(error.message)
}

export async function archiveProduct(id: string): Promise<void> {
  await setProductActive(id, false)
}

export async function archiveProducts(ids: string[]): Promise<void> {
  await setProductsActive(ids, false)
}

export async function restoreProduct(id: string): Promise<void> {
  await setProductActive(id, true)
}

export async function restoreProducts(ids: string[]): Promise<void> {
  await setProductsActive(ids, true)
}

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
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data as unknown as ProductRow[]).map(toProduct)
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
    .single()

  if (error) throw new Error(error.message)
  return toProduct(data)
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({
      name: input.name,
      category: input.category || null,
      description: input.description || null,
      price: input.price,
      stock: input.stock,
      low_stock_alert: input.lowStockAlert,
    })
    .eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteArchivedProduct(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("is_active", false)
    .select("id")
  if (error) throw new Error(error.message)
  if (!data?.length)
    throw new Error("Only archived products can be permanently deleted.")
}

export function stockStatus(product: Product): StockStatus {
  if (product.stock <= 0) return "Out of Stock"
  if (product.stock <= product.lowStockAlert) return "Low Stock"
  return "In Stock"
}

const categoryTones = [
  "bg-[#ffeacc] text-[#f0971c]",
  "bg-[#ffe0e4] text-[#ee4a5a]",
  "bg-[#dbeafe] text-[#2563eb]",
  "bg-[#d6f5e5] text-[#16a36b]",
  "bg-[#ece4ff] text-[#7c4dff]",
]
export const categoryTone = (category: string) =>
  categoryTones[
    [...category].reduce((sum, c) => sum + c.charCodeAt(0), 0) %
      categoryTones.length
  ]
