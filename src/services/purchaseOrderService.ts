import { supabase } from "@/services/supabaseClient"
import type { PurchaseOrder, PurchaseReceipt } from "@/types"

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
  "Partially Received",
  "Received",
  "Cancelled",
]

export function receivedPurchaseAmount(
  purchaseOrder: Pick<PurchaseOrder, "amount" | "quantity" | "receivedQuantity">,
): number {
  if (purchaseOrder.quantity <= 0) return 0
  const receivedAmount =
    (purchaseOrder.amount *
      Math.min(purchaseOrder.receivedQuantity, purchaseOrder.quantity)) /
    purchaseOrder.quantity
  return Math.round(receivedAmount * 100) / 100
}

export async function archivePurchaseOrders(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { data, error } = await supabase
    .from("purchase_orders")
    .update({ is_archived: true })
    .in("id", ids)
    .eq("is_archived", false)
    .in("status", ["Received", "Cancelled"])
    .select("id")
  if (error) throw new Error(error.message)
  if ((data?.length ?? 0) !== ids.length) {
    throw new Error(
      "Only received or cancelled purchase orders can be archived.",
    )
  }
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

export async function updatePurchaseOrder(
  id: string,
  quantity: number,
  expectedDate: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("update_purchase_order", {
    target_purchase_order: id,
    new_quantity: quantity,
    new_expected_date: expectedDate,
  })
  if (error) throw new Error(error.message)
}

export async function recordPurchaseReceipt(
  id: string,
  quantity: number,
  notes: string,
): Promise<void> {
  const { error } = await supabase.rpc("record_purchase_receipt", {
    target_purchase_order: id,
    received_now: quantity,
    receipt_notes: notes || null,
  })
  if (error) throw new Error(error.message)
}

type ReceiptRow = {
  id: string
  quantity: number
  remaining_quantity: number
  received_at: string
  received_by_name: string
  notes: string | null
}

export async function listPurchaseReceipts(
  purchaseOrderId: string,
): Promise<PurchaseReceipt[]> {
  const { data, error } = await supabase
    .from("purchase_order_receipts")
    .select(
      "id, quantity, remaining_quantity, received_at, received_by_name, notes",
    )
    .eq("purchase_order_id", purchaseOrderId)
    .order("received_at", { ascending: false })

  if (error) throw new Error(error.message)

  return (data as unknown as ReceiptRow[]).map((row) => ({
    id: row.id,
    quantity: row.quantity,
    remainingQuantity: row.remaining_quantity,
    receivedAt: row.received_at,
    receivedByName: row.received_by_name,
    notes: row.notes ?? "",
  }))
}
