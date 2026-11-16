import { supabase } from "@/services/supabaseClient"
import type { PurchaseOrder } from "@/types"

type PoRow = {
  id: string
  po_number: string
  amount: number | string
  status: string
  expected_date: string | null
  created_at: string
  product_id: string | null
  quantity: number | null
  received_quantity: number
  is_archived: boolean
  suppliers: { name: string } | { name: string }[] | null
  products: { name: string } | { name: string }[] | null
}

export const poStatuses = [
  "Pending",
  "Pending Approval",
  "Approved",
  "Rejected",
  "In transit",
  "Received",
  "Cancelled",
]

export async function archivePurchaseOrders(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from("purchase_orders")
    .update({ is_archived: true })
    .in("id", ids)
  if (error) throw new Error(error.message)
}

export async function restorePurchaseOrders(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from("purchase_orders")
    .update({ is_archived: false })
    .in("id", ids)
  if (error) throw new Error(error.message)
}

export async function deleteArchivedPurchaseOrder(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .delete()
    .eq("id", id)
    .eq("is_archived", true)
    .select("id")
  if (error) throw new Error(error.message)
  if (!data?.length)
    throw new Error(
      "Only archived purchase stock records can be permanently deleted.",
    )
}

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      "id, po_number, amount, status, expected_date, created_at, product_id, quantity, received_quantity, is_archived, suppliers(name), products(name)",
    )
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)

  return (data as unknown as PoRow[]).map((r) => {
    const supplier = Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers
    const product = Array.isArray(r.products) ? r.products[0] : r.products

    return {
      id: r.id,
      poNumber: r.po_number,
      supplierName: supplier?.name ?? "—",
      productId: r.product_id,
      productName: product?.name ?? "—",
      quantity: r.quantity ?? 1,
      receivedQuantity: r.received_quantity,
      amount: Number(r.amount),
      status: r.status,
      isArchived: r.is_archived,
      expectedDate: r.expected_date,
      createdAt: r.created_at,
    }
  })
}

export async function createPurchaseOrder(input: {
  supplierId: string | null
  productId: string | null
  quantity: number
  expectedDate: string | null
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_purchase_order", {
    purchase_supplier_id: input.supplierId,
    purchase_product_id: input.productId,
    purchase_quantity: input.quantity,
    purchase_expected_date: input.expectedDate,
  })
  if (error) throw new Error(error.message)
  if (typeof data !== "string") {
    throw new Error("Could not confirm the purchase order status.")
  }
  return data
}

export async function updatePurchaseOrderStatus(
  id: string,
  status: string,
): Promise<void> {
  const { error } = await supabase.rpc("set_purchase_order_status", {
    target_purchase_order: id,
    next_status: status,
  })
  if (error) throw new Error(error.message)
}

export async function recordPurchaseReceipt(
  id: string,
  quantity: number,
): Promise<void> {
  const { error } = await supabase.rpc("record_purchase_receipt", {
    target_purchase_order: id,
    received_now: quantity,
  })
  if (error) throw new Error(error.message)
}
