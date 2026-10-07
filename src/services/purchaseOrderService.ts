import { supabase } from "@/services/supabaseClient";
import type { PurchaseOrder } from "@/types";

type PoRow = {
  id: string; 
  po_number: string; 
  amount: number | string; 
  status: string; 
  expected_date: string | null; 
  created_at: string;
  product_id: string | null;
  quantity: number | null;
  suppliers: { name: string } | { name: string }[] | null;
  products: { name: string } | { name: string }[] | null;
};

export const poStatuses = ["Pending", "Approved", "In transit", "Received", "Cancelled"];

export async function clearAllPurchaseOrders(): Promise<void> {
  const { error } = await supabase
    .from("purchase_orders")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) throw new Error(error.message);
}

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("id, po_number, amount, status, expected_date, created_at, product_id, quantity, suppliers(name), products(name)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data as unknown as PoRow[]).map((r) => {
    const supplier = Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers;
    const product = Array.isArray(r.products) ? r.products[0] : r.products;

    return { 
      id: r.id, 
      poNumber: r.po_number, 
      supplierName: supplier?.name ?? "—", 
      productId: r.product_id,
      productName: product?.name ?? "—",
      quantity: r.quantity ?? 1,
      amount: Number(r.amount), 
      status: r.status, 
      expectedDate: r.expected_date, 
      createdAt: r.created_at 
    };
  });
}

export async function createPurchaseOrder(input: { 
  supplierId: string | null; 
  productId: string | null;
  quantity: number;
  amount: number; 
  expectedDate: string | null 
}): Promise<void> {
  const { error } = await supabase.from("purchase_orders").insert({ 
    supplier_id: input.supplierId, 
    product_id: input.productId,
    quantity: input.quantity,
    amount: input.amount, 
    expected_date: input.expectedDate 
  });
  if (error) throw new Error(error.message);
}

export async function updatePurchaseOrderStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}