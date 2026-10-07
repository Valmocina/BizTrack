// Users page (admin only): lists accounts from the `profiles` table and lets admins delete them.
import { DataTable } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { useAuth } from "@/context/AuthContext";
import { useLoad } from "@/hooks/useLoad";
import { formatDate } from "@/services/format";
import { deleteUser, listProfiles } from "@/services/userService";
import type { Notify, Profile } from "@/types";

export function UserManager({ notify }: { notify: Notify }) {
  const { user } = useAuth();
  const { data: profiles, setData, loading } = useLoad(listProfiles, [] as Profile[], notify, "users");

  const remove = async (profile: Profile) => {
    if (!window.confirm(`Delete ${profile.email}? Their account will be permanently removed.`)) return;
    try {
      await deleteUser(profile.id);
      setData((current) => current.filter((p) => p.id !== profile.id));
      notify(`${profile.email} was deleted.`);
    } catch (error) {
      notify(`Could not delete: ${(error as Error).message}`);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="page-title">Users</h1>
      <DataTable
        columns={["Name", "Email", "Role", "Joined", "Actions"]}
        rows={profiles.map((p) => [
          p.fullName || "—",
          p.email,
          <Pill tone={p.role === "admin" ? "blue" : "gray"}>{p.role === "admin" ? "Admin" : "Employee"}</Pill>,
          formatDate(p.createdAt),
          p.id === user?.id ? "" : <button onClick={() => remove(p)} className="text-slate-400 hover:text-rose-600" aria-label={`Delete ${p.email}`}><Icon name="trash" size={18} /></button>,
        ])}
        loading={loading}
        emptyText="No users yet."
        footer={<span>{profiles.length} users</span>}
      />
    </div>
  );
}
