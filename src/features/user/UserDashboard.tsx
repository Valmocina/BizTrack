// Employee dashboard: assigned orders, pending purchase orders, low stock count and upcoming PO deadlines.
import { Pill } from "@/components/ui/Pill";
import { DataTable } from "@/components/ui/DataTable";
import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/context/AuthContext";
import { useLoad } from "@/hooks/useLoad";
import { formatDate } from "@/services/format";
import { isOpenOrder, listOrders } from "@/services/orderService";
import { listProducts, stockStatus } from "@/services/productService";
import { listPurchaseOrders } from "@/services/purchaseOrderService";
import type { Notify, Order, PurchaseOrder, Product } from "@/types";

type DashboardData = {
  orders: Order[];
  pos: PurchaseOrder[];
  products: Product[];
};

export function UserDashboard({ notify }: { notify: Notify }) {
  const { user } = useAuth();
  const { data, loading } = useLoad(
    async () => {
      const [orders, pos, products] = await Promise.all([listOrders(), listPurchaseOrders(), listProducts()]);
      return { orders, pos, products };
    },
    { orders: [], pos: [], products: [] } as DashboardData,
    notify,
    "dashboard",
  );

  const today = new Date().toISOString().slice(0, 10);
  const mine = data.orders.filter((o) => o.assignedTo === user?.id && isOpenOrder(o));
  
  // Replaced isOpenPo with the inline status check
  const openPos = data.pos.filter((p) => p.status !== "Completed" && p.status !== "Cancelled" && p.status !== "Closed");
  
  const lowStock = data.products.filter((p) => stockStatus(p) !== "In Stock");
  // Open POs with a date, soonest first
  const upcoming = openPos.filter((p) => p.expectedDate).sort((a, b) => a.expectedDate!.localeCompare(b.expectedDate!)).slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Employee Dashboard</h1>
      <div>
        <h2 className="text-xl font-bold text-slate-800">Welcome, {user?.name?.split(" ")[0] || "Staff"}!</h2>
        <p className="mt-1 text-sm text-slate-400">Here’s your daily overview.</p>
      </div>
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard icon="file" tint="bg-blue-100 text-blue-500" label="My Assigned Orders" value={mine.length} />
        <StatCard icon="file" tint="bg-purple-100 text-purple-500" label="Pending P.O." value={openPos.length} />
        <StatCard icon="alert" tint="bg-red-100 text-red-500" label="Low Stock Items" value={lowStock.length} />
      </section>
      <section>
        <h2 className="section-title mb-3">Upcoming Deadlines</h2>
        <DataTable
          columns={["PO Number", "Supplier", "Expected Date", "Status"]}
          rows={upcoming.map((p) => [p.poNumber, p.supplierName, formatDate(p.expectedDate), p.expectedDate! < today ? <Pill tone="red">Overdue</Pill> : <Pill tone="green">On Time</Pill>])}
          loading={loading}
          emptyText="No upcoming deadlines."
        />
      </section>
    </div>
  );
}