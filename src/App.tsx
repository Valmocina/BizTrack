// Root component: login gate, then one layout (sidebar + page) whose menu and pages depend on the user's role.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Sidebar, type NavItem } from "@/components/Sidebar";
import { Icon } from "@/components/ui/Icon";
import { Toast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { AddProduct } from "@/features/admin/AddProduct";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { OrderManager } from "@/features/admin/OrderManager";
import { ProductTable } from "@/features/admin/ProductTable";
import { PurchaseOrders } from "@/features/admin/PurchaseOrders";
import { SupplierManager } from "@/features/admin/SupplierManager";
import { UserManager } from "@/features/admin/UserManager";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { InventoryTransactions } from "@/features/shared/InventoryTransactions";
import { NotificationsPage } from "@/features/shared/NotificationsPage";
import { SettingsPage } from "@/features/shared/SettingsPage";
import { UserDashboard } from "@/features/user/UserDashboard";
import { countUnread } from "@/services/notificationService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { Notify, Product } from "@/types";

const adminMenu: NavItem[] = [
  { page: "Dashboard", icon: "home" },
  { page: "Inventory", icon: "warehouse" },
  { page: "Products", icon: "cubes" },
  { page: "Orders", icon: "clipboard" },
  { page: "Purchase Stock", icon: "orders" },
  { page: "Suppliers", icon: "suppliers" },
  { page: "Notifications", icon: "bell" },
  { page: "Users", icon: "users", dividerBefore: true },
  { page: "Settings", icon: "settings" },
];
const employeeMenu: NavItem[] = [
  { page: "Dashboard", icon: "home" },
  { page: "Inventory", icon: "warehouse" },
  { page: "Products", icon: "cubes" },
  { page: "Orders", icon: "clipboard" },
  { page: "Purchase Stock", icon: "orders" },
  { page: "Notifications", icon: "bell" },
];

function Shell() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const menu = isAdmin ? adminMenu : employeeMenu;

  // Initialize active tab from localStorage so the page view is preserved on reload or tab blur
  const [active, setActive] = useState<string>(() => {
    return localStorage.getItem("biztrack_active_tab") || "Dashboard";
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [unread, setUnread] = useState(0);
  const [reorderProduct, setReorderProduct] = useState<string>("");

  // Sync state changes with localStorage whenever the active view changes
  useEffect(() => {
    localStorage.setItem("biztrack_active_tab", active);
  }, [active]);

  // Show a toast message for 3 seconds
  const notify: Notify = useCallback((message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  }, []);

  const refreshUnread = useCallback(() => { 
    countUnread().then(setUnread).catch(() => {}); 
  }, []);

  useEffect(refreshUnread, [active, refreshUnread]);

  // Set up Supabase Realtime Listener for instant live notifications
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel("realtime-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const newNotif = payload.new;
          notify(`🔔 ${newNotif.title || "Notification"}: ${newNotif.message || ""}`);
          refreshUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [notify, refreshUnread]);

  // Navigate to a page (leaving a search, edit, or target reorder product behind)
  const goTo = (page: string, targetProduct?: string) => {
    setEditing(null);
    setProductQuery("");
    setReorderProduct(targetProduct || "");
    setActive(page);
  };

  // Pages an employee may open; anything else falls back to the dashboard
  const allowed = menu.some((item) => item.page === active) || (isAdmin && active === "Add product");
  const page = allowed ? active : "Dashboard";

  let content: ReactNode;
  switch (page) {
    case "Inventory": content = <InventoryTransactions notify={notify} />; break;
    case "Products": content = <ProductTable notify={notify} canEdit={isAdmin} initialQuery={productQuery} onAdd={() => goTo("Add product")} onEdit={(p) => { setEditing(p); setActive("Add product"); }} />; break;
    case "Add product": content = <AddProduct product={editing} notify={notify} goTo={goTo} />; break;
    case "Orders": content = <OrderManager notify={notify} canEdit={isAdmin} />; break;
    case "Purchase Stock": 
      content = (
        <PurchaseOrders 
          notify={notify} 
          canEdit={isAdmin} 
          initialProductName={reorderProduct} 
        />
      ); 
      break;
    case "Suppliers": content = <SupplierManager notify={notify} canEdit={isAdmin} />; break;
    case "Notifications": 
      content = (
        <NotificationsPage 
          notify={notify} 
          onChange={refreshUnread} 
          onReorder={(productName) => goTo("Purchase Stock", productName)} 
        />
      ); 
      break;
    case "Users": content = <UserManager notify={notify} />; break;
    case "Settings": content = <SettingsPage notify={notify} />; break;
    default: content = isAdmin ? <AdminDashboard goTo={goTo} notify={notify} /> : <UserDashboard notify={notify} />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar items={menu} active={page} setActive={goTo} open={menuOpen} close={() => setMenuOpen(false)} hasUnread={unread > 0} />
      <div className="min-w-0 flex-1">
        {/* Mobile top bar with the menu button */}
        <header className="flex h-14 items-center gap-3 border-b border-[#e5ebf3] bg-white px-4 lg:hidden">
          <button onClick={() => setMenuOpen(true)} className="text-slate-600" aria-label="Open navigation"><Icon name="menu" /></button>
          <span className="font-bold text-slate-800">BizTrack</span>
        </header>
        {isAdmin && page === "Dashboard" && (
          <Navbar hasUnread={unread > 0} onBell={() => goTo("Notifications")} onSearch={(query) => { setEditing(null); setProductQuery(query); setActive("Products"); }} />
        )}
        <main className="mx-auto w-full max-w-[1500px] p-5 lg:p-8">{content}</main>
      </div>
      <Toast message={notice} onDismiss={() => setNotice("")} />
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <div className="card max-w-md p-6 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Supabase is not configured.</p>
          <p className="mt-2">Copy <code>.env.example</code> to <code>.env</code>, fill in your project URL and anon key, then restart the dev server.</p>
        </div>
      </div>
    );
  }
  return (
    <ProtectedRoute>
      <Shell />
    </ProtectedRoute>
  );
}