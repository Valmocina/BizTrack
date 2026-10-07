// Stock movements in the Supabase `inventory_transactions` table.
// The database updates product stock automatically when a row is inserted.
import { supabase } from "@/services/supabaseClient";
import type { InventoryTransaction, TxType } from "@/types";

export async function clearInventoryTransactions(): Promise<void> {
  const { error } = await supabase
    .from("inventory_transactions")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Standard way to delete all rows in Supabase

  if (error) {
    console.error("Error clearing inventory transactions:", error.message);
    throw new Error(error.message);
  }
}

type TxRow = {
  id: string; type: TxType; quantity: number; reference: string | null; remarks: string | null; created_at: string;
  products: { name: string } | { name: string }[] | null;
};

export async function listTransactions(): Promise<InventoryTransaction[]> {
  const { data, error } = await supabase.from("inventory_transactions").select("id, type, quantity, reference, remarks, created_at, products(name)").order("created_at", { ascending: false }).limit(1000);
  if (error) throw new Error(error.message);
  return (data as unknown as TxRow[]).map((r) => {
    const product = Array.isArray(r.products) ? r.products[0] : r.products;
    return { id: r.id, productName: product?.name ?? "—", type: r.type, quantity: r.quantity, reference: r.reference ?? "", remarks: r.remarks ?? "", createdAt: r.created_at };
  });
}

export async function createTransaction(input: { productId: string; type: TxType; quantity: number; reference: string; remarks: string }): Promise<void> {
  const { error } = await supabase.from("inventory_transactions").insert({
    product_id: input.productId, type: input.type, quantity: input.quantity,
    reference: input.reference || null, remarks: input.remarks || null,
  });
  if (error) throw new Error(error.message);
}
