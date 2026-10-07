// Reads the Supabase `profiles` table (admin only for other people's rows, enforced by RLS).
import { supabase } from "@/services/supabaseClient";
import type { Profile, Role } from "@/types";

type ProfileRow = { id: string; email: string; full_name: string | null; role: Role; created_at: string };

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("profiles").select("id, email, full_name, role, created_at").order("created_at");
  if (error) throw new Error(error.message);
  return (data as ProfileRow[]).map((row) => ({ id: row.id, email: row.email, fullName: row.full_name ?? "", role: row.role, createdAt: row.created_at }));
}

// Admin only: deletes the account through the `admin_delete_user` database function
export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_user", { target: id });
  if (error) throw new Error(error.message);
}
