// Admin home: KPI cards, inventory movement chart, product categories, recent notifications/transactions and quick actions.
import { Icon } from "@/components/ui/Icon";
import { NotificationIcon } from "@/components/ui/NotificationIcon";
import { StatCard } from "@/components/ui/StatCard";
import { TransactionTable } from "@/components/TransactionTable";
import { MovementChart } from "@/features/admin/MovementChart";
import { useAuth } from "@/context/AuthContext";
import { useLoad } from "@/hooks/useLoad";
import { listTransactions } from "@/services/inventoryService";
import { listNotifications } from "@/services/notificationService";
import { isOpenOrder, listOrders } from "@/services/orderService";
import { listProducts, stockStatus } from "@/services/productService";
import { listPurchaseOrders } from "@/services/purchaseOrderService";
import { timeAgo } from "@/services/format";
import type { IconName, Notify } from "@/types";

const donutColors = ["#0891c4", "#2563eb", "#fb923c", "#f87171", "#a78bfa", "#94a3b8"];
const weekAgo = () => Date.now() - 7 * 24 * 60 * 60 * 1000;

export function AdminDashboard({ goTo, notify }: { goTo: (page: string) => void; notify: Notify }) {
  const { user } = useAuth();
  const { data, loading } = useLoad(
    async () => {
      const [products, orders, pos, notifications, transactions] = await Promise.all([
        listProducts(),
        listOrders(),
        listPurchaseOrders(),
        listNotifications(),
        listTransactions(),
      ]);
      return { products, orders, pos, notifications, transactions };
    },
    { products: [], orders: [], pos: [], notifications: [], transactions: [] } as Awaited<ReturnType<typeof loadShape>>,
    notify,
    "dashboard",
  );
  const { products, orders, pos, notifications, transactions } = data;

  const isNew = (createdAt: string) => new Date(createdAt).getTime() > weekAgo();
  const lowStock = products.filter((p) => stockStatus(p) !== "In Stock");
  const outOfStock = products.filter((p) => stockStatus(p) === "Out of Stock").length;
  const openOrders = orders.filter(isOpenOrder);
  const openPos = pos.filter((p) => p.status !== "Completed" && p.status !== "Cancelled" && p.status !== "Closed");

  // Product categories donut: top 4 categories + "Other"
  const counts = new Map<string, number>();
  products.forEach((p) => counts.set(p.category || "Uncategorized", (counts.get(p.category || "Uncategorized") ?? 0) + 1));
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const slices = sorted.length > 5 ? [...sorted.slice(0, 4), ["Other", sorted.slice(4).reduce((sum, [, n]) => sum + n, 0)] as [string, number]] : sorted;
  const total = products.length;
  let running = 0;
  const gradient = total
    ? `conic-gradient(${slices.map(([, n], i) => { const from = (running / total) * 100; running += n; return `${donutColors[i]} ${from}\%${(running / total) * 100}%`; }).join(", ")})`
    : "#e2e8f0";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const actions: [IconName, string, string][] = [
    ["plus", "Add Product", "Add product"],
    ["file", "Create Purchase Order", "Purchase Orders"],
    ["cubes", "View Inventory", "Inventory"],
    ["cart", "Manage Orders", "Orders"],
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{greeting}, {user?.name.split(" ")[0]}</h1>
          <p className="page-description !mt-2 !text-[15px]">Here’s what’s happening with your business today.</p>
        </div>
        <p className="hidden items-center gap-2 pt-3 text-sm text-slate-600 sm:flex">{new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} <Icon name="calendar" size={18} className="text-slate-400" /></p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="box" tint="bg-blue-100 text-blue-500" label="Total Products" value={products.length} change={`${products.filter((p) => isNew(p.createdAt)).length} new`} note="this week" />
        <StatCard icon="alert" tint="bg-red-100 text-red-500" label="Low Stock Items" value={lowStock.length} change={`${outOfStock} out of stock`} warn />
        <StatCard icon="cart" tint="bg-emerald-100 text-emerald-500" label="Pending Orders" value={openOrders.length} change={`${orders.filter((o) => isNew(o.createdAt)).length} new`} note="this week" />
        <StatCard icon="file" tint="bg-purple-100 text-purple-500" label="Pending P.O." value={openPos.length} change={`${pos.filter((p) => isNew(p.createdAt)).length} new`} note="this week" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.8fr_1fr_1fr]">
        <article className="card p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">Inventory Movement</h2>
            <div className="flex gap-4 text-xs text-slate-600">
              {[["In", "bg-emerald-500"], ["Out", "bg-blue-600"], ["Adjust", "bg-amber-500"]].map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</span>)}
            </div>
          </div>
          <MovementChart transactions={transactions} />
        </article>

        <article className="card p-6">
          <h2 className="section-title">Product Categories</h2>
          <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
            <div className="relative h-[140px] w-[140px] shrink-0 rounded-full" style={{ background: gradient }}>
              <div className="absolute inset-[16px] grid place-items-center rounded-full bg-white text-center">
                <div><strong className="block text-2xl text-slate-800">{total}</strong><span className="text-[10px] text-slate-400">Total Products</span></div>
              </div>
            </div>
            <ul className="w-full space-y-2.5 text-xs">
              {slices.map(([label, n], i) => (
                <li key={label} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: donutColors[i] }} />
                  <span className="truncate text-slate-600">{label}</span>
                  <span className="ml-auto font-semibold text-slate-700">{n}</span>
                  <span className="w-9 text-right text-slate-400">{Math.round((n / total) * 100)}%</span>
                </li>
              ))}
              {!slices.length && <li className="text-slate-400">No products yet.</li>}
            </ul>
          </div>
        </article>

        <article className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Recent Notifications</h2>
            <button onClick={() => goTo("Notifications")} className="text-xs font-semibold text-blue-600 hover:underline">View all →</button>
          </div>
          <ul className="mt-4 space-y-4">
            {notifications.slice(0, 4).map((n) => (
              <li key={n.id} className="flex items-start gap-3">
                <NotificationIcon type={n.type} size={18} box={40} />
                <div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-800">{n.title}</p><p className="text-[11px] text-slate-400">{n.message}</p></div>
                <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(n.createdAt)}</span>
              </li>
            ))}
            {!notifications.length && <li className="py-6 text-center text-xs text-slate-400">{loading ? "Loading..." : "No notifications yet."}</li>}
          </ul>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[2.2fr_1fr_1fr]">
        <div>
          <h2 className="section-title mb-3">Recent Transactions</h2>
          <TransactionTable transactions={transactions.slice(0, 5)} loading={loading} />
        </div>
        <article className="card p-6">
          <h2 className="section-title">Quick Actions</h2>
          <div className="mt-4 space-y-3">
            {actions.map(([icon, label, page]) => (
              <button key={label} onClick={() => goTo(page)} className="flex w-full items-center gap-3 rounded-md border border-[#dbe5f2] bg-[#f7f9fc] p-1.5 text-left text-xs font-bold text-slate-800 hover:bg-white">
                <span className="grid h-8 w-8 place-items-center rounded bg-[#1f4f9e] text-white"><Icon name={icon} size={16} /></span>{label}
              </button>
            ))}
          </div>
        </article>
        <article className="card flex flex-col items-center p-6 text-center">
          {/* Placeholder for the illustration */}
          <div className="mb-5 h-28 w-full rounded-lg bg-[#eef3fa]" aria-hidden="true" />
          <h2 className="text-base font-bold text-slate-800">Stay on top of your inventory</h2>
          <p className="mt-2 text-xs text-slate-400">Track, manage and grow your business with BizTrack.</p>
          <button onClick={() => goTo("Settings")} className="btn-primary mt-5 !h-11 w-full max-w-[180px] !text-[13px]">Customize Dashboard</button>
        </article>
      </section>
    </div>
  );
}

// Only used to describe the shape of the dashboard data for TypeScript
declare function loadShape(): Promise<{
  products: Awaited<ReturnType<typeof listProducts>>;
  orders: Awaited<ReturnType<typeof listOrders>>;
  pos: Awaited<ReturnType<typeof listPurchaseOrders>>;
  notifications: Awaited<ReturnType<typeof listNotifications>>;
  transactions: Awaited<ReturnType<typeof listTransactions>>;
}>;