import { supabase } from "@/services/supabaseClient";
import type { Order } from "@/types";

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string | null;
  status: string;
  total: number | string;
  created_at: string;
  assigned_to: string | null;
  product_id: string | null;
  quantity: number | null;
  products: { name: string } | { name: string }[] | null;
};

export const orderStatuses = ["Pending", "Processing", "Completed", "Cancelled"];
export const isOpenOrder = (o: Order) => o.status !== "Completed" && o.status !== "Cancelled";

export async function clearAllOrders(): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
    
  if (error) throw new Error(error.message);
}

export async function listOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, status, total, created_at, assigned_to, product_id, quantity, products(name)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data as unknown as OrderRow[]).map((r) => {
    const product = Array.isArray(r.products) ? r.products[0] : r.products;
    return {
      id: r.id,
      orderNumber: r.order_number,
      customerName: r.customer_name ?? "Walk-in Customer",
      productId: r.product_id,
      productName: product?.name ?? "—",
      quantity: r.quantity ?? 1,
      status: r.status,
      total: Number(r.total),
      createdAt: r.created_at,
      assignedTo: r.assigned_to,
    };
  });
}

export async function createOrder(input: {
  customerName: string;
  productId: string | null;
  quantity: number;
  total: number;
  assignedTo?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("orders").insert({
    customer_name: input.customerName,
    product_id: input.productId,
    quantity: input.quantity,
    total: input.total,
    assigned_to: input.assignedTo || null,
  });

  if (error) throw new Error(error.message);
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}