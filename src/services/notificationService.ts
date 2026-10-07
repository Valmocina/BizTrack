// Alerts in the Supabase `notifications` table (low stock and new orders are created by database triggers).
import { supabase } from "@/services/supabaseClient";
import type { AppNotification, NotificationType } from "@/types";

type Row = { 
  id: string; 
  type: NotificationType; 
  title: string; 
  message: string | null; 
  is_read: boolean; 
  created_at: string; 
};

/**
 * Removes low stock notifications for products that are back in stock.
 */
async function cleanupRestockedNotifications(): Promise<void> {
  try {
    const { data: healthyProducts } = await supabase
      .from("products")
      .select("name, stock, low_stock_alert");

    if (!healthyProducts || healthyProducts.length === 0) return;

    const restockedNames = healthyProducts
      .filter((p) => Number(p.stock) > Number(p.low_stock_alert ?? 5))
      .map((p) => p.name);

    if (restockedNames.length === 0) return;

    for (const name of restockedNames) {
      await supabase
        .from("notifications")
        .delete()
        .eq("type", "low_stock")
        .ilike("message", `%${name}%`);
    }
  } catch (err) {
    console.error("Error cleaning up restocked notifications:", err);
  }
}

export async function listNotifications(): Promise<AppNotification[]> {
  await cleanupRestockedNotifications();

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, message, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return (data as Row[]).map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    message: r.message ?? "",
    isRead: r.is_read,
    createdAt: r.created_at,
  }));
}

export async function countUnread(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function markAllRead(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("is_read", false);

  if (error) throw new Error(error.message);
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function clearNotifications(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .not("id", "is", null);

  if (error) throw new Error(error.message);
}

export async function createSystemNotification(input: {
  type: NotificationType;
  title: string;
  message: string;
}): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    type: input.type,
    title: input.title,
    message: input.message,
    is_read: false,
  });

  if (error) console.error("Could not send notification:", error.message);
}