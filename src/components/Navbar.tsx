// Top bar shown on the admin dashboard: search, notification bell and profile (photo left blank).
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";

export function Navbar({ onSearch, onBell, hasUnread }: { onSearch: (query: string) => void; onBell: () => void; hasUnread: boolean }) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };
  return (
    <header className="flex h-[72px] items-center gap-4 border-b border-[#e5ebf3] bg-[#eef3fa] px-6 lg:px-6">
      <form onSubmit={submit} className="flex h-10 w-full max-w-[340px] items-center gap-3 rounded-md border border-[#e5ebf3] bg-white px-3.5 text-slate-400">
        <Icon name="search" size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" placeholder="Search anything..." />
      </form>
      <div className="ml-auto flex items-center gap-5">
        <button onClick={onBell} className="relative text-slate-500 hover:text-slate-700" aria-label="Notifications">
          <Icon name="bell" size={22} />
          {hasUnread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#ff5d68] ring-2 ring-[#eef3fa]" />}
        </button>
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-full bg-slate-300" aria-hidden="true" />
          <div className="hidden text-left sm:block">
            <p className="text-sm font-bold leading-tight text-slate-800">{user?.name}</p>
            <p className="text-[11px] capitalize text-slate-400">{user?.role === "admin" ? "Administrator" : user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
