// Dark navigation menu (slides in on mobile). The menu items are passed in so admins and employees see different pages.
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/context/AuthContext";
import type { IconName } from "@/types";

export type NavItem = { page: string; icon: IconName; dividerBefore?: boolean };

export function Sidebar({ items, active, setActive, open, close, hasUnread }: {
  items: NavItem[]; active: string; setActive: (page: string) => void; open: boolean; close: () => void; hasUnread: boolean;
}) {
  const { signOut } = useAuth();
  const select = (page: string) => {
    setActive(page);
    close();
  };

  return (
    <>
      {open && <button className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={close} aria-label="Close menu" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col bg-[#10233f] text-slate-300 transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[88px] items-center justify-between px-6">
          <button className="flex items-center gap-3 text-white" onClick={() => select("Dashboard")}>
            <Logo className="h-8 w-8" />
            <span className="text-[26px] font-bold tracking-tight">BizTrack</span>
          </button>
          <button className="text-slate-400 lg:hidden" onClick={close} aria-label="Close navigation"><Icon name="close" /></button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 pt-3">
          {items.map((item) => {
            const selected = active === item.page || (active === "Add product" && item.page === "Products");
            return (
              <div key={item.page}>
                {item.dividerBefore && <div className="my-3 border-t border-slate-700/60" />}
                <button
                  onClick={() => select(item.page)}
                  className={`flex w-full items-center gap-4 rounded-lg px-3.5 py-3 text-left text-sm font-medium transition ${selected ? "bg-[#1f4f9e] text-white" : "hover:bg-white/5 hover:text-white"}`}
                >
                  <Icon name={item.icon} size={20} />
                  <span className="flex-1">{item.page}</span>
                  {item.page === "Notifications" && hasUnread && <span className="h-3 w-3 rounded-full bg-[#ff5d68]" />}
                </button>
              </div>
            );
          })}
        </nav>
        <button onClick={signOut} className="m-4 flex items-center gap-4 rounded-lg px-3.5 py-3 text-sm font-medium transition hover:bg-white/5 hover:text-white">
          <Icon name="logout" size={20} /> Logout
        </button>
      </aside>
    </>
  );
}
