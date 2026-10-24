// Stock movements in the Supabase `inventory_transactions` table.
// The database updates product stock automatically when a row is inserted.
import { supabase } from "@/services/supabaseClient"
import type { InventoryTransaction, TxType } from "@/types"

export async function archiveInventoryTransactions(
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return
  for (let index = 0; index < ids.length; index += 100) {
    const { error } = await supabase
      .from("inventory_transactions")
      .update({ is_archived: true })
      .in("id", ids.slice(index, index + 100))
    if (error) throw new Error(error.message)
  }
}

export async function restoreInventoryTransactions(
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return
  for (let index = 0; index < ids.length; index += 100) {
    const { error } = await supabase
      .from("inventory_transactions")
      .update({ is_archived: false })
      .in("id", ids.slice(index, index + 100))
    if (error) throw new Error(error.message)
  }
}

type TxRow = {
  id: string
  product_id: string
  type: TxType
  quantity: number
  reference: string | null
  remarks: string | null
  previous_stock: number | null
  new_stock: number | null
  created_by: string | null
  is_archived: boolean
  created_at: string
  products: { name: string } | { name: string }[] | null
}

export async function listTransactions(): Promise<InventoryTransaction[]> {
  const transactions: InventoryTransaction[] = []
  const pageSize = 1000

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("inventory_transactions")
      .select(
        "id, product_id, type, quantity, reference, remarks, previous_stock, new_stock, created_by, is_archived, created_at, products(name)",
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(error.message)

    const rows = data as unknown as TxRow[]
    transactions.push(
      ...rows.map((r) => {
        const product = Array.isArray(r.products) ? r.products[0] : r.products
        return {
          id: r.id,
          productId: r.product_id,
          productName: product?.name ?? "—",
          type: r.type,
          quantity: r.quantity,
          reference: r.reference ?? "",
          remarks: r.remarks ?? "",
          previousStock: r.previous_stock,
          newStock: r.new_stock,
          createdBy: r.created_by,
          isArchived: r.is_archived,
          createdAt: r.created_at,
        }
      }),
    )

    if (rows.length < pageSize) return transactions
  }
}

export async function createTransaction(input: {
  productId: string
  type: TxType
  quantity: number
  reference: string
  remarks: string
}): Promise<void> {
  const { error } = await supabase.from("inventory_transactions").insert({
    product_id: input.productId,
    type: input.type,
    quantity: input.quantity,
    reference: input.reference || null,
    remarks: input.remarks || null,
  })
  if (error) throw new Error(error.message)
}
