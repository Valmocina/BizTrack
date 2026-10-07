// Settings: shows the signed-in account and lets the person change their password.
import { useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/services/supabaseClient";
import type { Notify } from "@/types";

export function SettingsPage({ notify }: { notify: Notify }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password"));
    if (password !== String(data.get("confirm"))) return notify("Passwords do not match.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return notify(`Could not change password: ${error.message}`);
    form.reset();
    notify("Password updated.");
  };

  return (
    <div className="space-y-5">
      <h1 className="page-title">Settings</h1>
      <section className="card max-w-[640px] space-y-1 p-6">
        <h2 className="section-title mb-3">Account</h2>
        <p className="text-sm text-slate-700"><b>Name:</b> {user?.name}</p>
        <p className="text-sm text-slate-700"><b>Email:</b> {user?.email}</p>
        <p className="text-sm text-slate-700"><b>Role:</b> {user?.role === "admin" ? "Administrator" : "Employee"}</p>
      </section>
      <form onSubmit={submit} className="card max-w-[640px] space-y-4 p-6">
        <h2 className="section-title">Change password</h2>
        <label className="field"><span>New password</span><input name="password" type="password" required minLength={6} autoComplete="new-password" /></label>
        <label className="field"><span>Confirm new password</span><input name="confirm" type="password" required minLength={6} autoComplete="new-password" /></label>
        <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Update password"}</button>
      </form>
    </div>
  );
}
