import { DataTable } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { useLoad } from "@/hooks/useLoad";
import { formatDate } from "@/services/format";
import {
  clearNotifications,
  deleteNotification,
  listNotifications,
  markAllRead,
  markAsRead,
} from "@/services/notificationService";
import type { AppNotification, Notify } from "@/types";

export function NotificationsPage({
  notify,
  onChange,
  onReorder,
}: {
  notify: Notify;
  onChange: () => void;
  onReorder?: (productName: string) => void;
}) {
  const { data: notifications, setData: setNotifications, loading, reload } = useLoad(
    listNotifications,
    [] as AppNotification[],
    notify,
    "notifications"
  );

  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead(id);
      setNotifications((curr) => curr.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      onChange();
    } catch (error) {
      notify(`Could not update notification: ${(error as Error).message}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      setNotifications((curr) => curr.map((n) => ({ ...n, isRead: true })));
      onChange();
      notify("All notifications marked as read.");
    } catch (error) {
      notify(`Could not update: ${(error as Error).message}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications((curr) => curr.filter((n) => n.id !== id));
      onChange();
    } catch (error) {
      notify(`Could not delete notification: ${(error as Error).message}`);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear all notifications?")) return;
    try {
      await clearNotifications();
      await reload();
      onChange();
      notify("Notification list cleared.");
    } catch (error) {
      notify(`Could not clear notifications: ${(error as Error).message}`);
    }
  };

  const columns = ["Type", "Title", "Message", "Date", "Actions"];

  const rows = notifications.map((n) => [
    <Pill key={`pill-${n.id}`} tone={n.type === "low_stock" ? "red" : "blue"}>
      {n.type === "low_stock" ? "Low Stock" : "Order"}
    </Pill>,
    <span key={`title-${n.id}`} className={n.isRead ? "text-slate-600" : "font-bold text-slate-900"}>
      {n.title}
    </span>,
    <span key={`msg-${n.id}`} className={n.isRead ? "text-slate-500" : "font-semibold text-slate-800"}>
      {n.message}
    </span>,
    formatDate(n.createdAt),
    <div key={`act-${n.id}`} className="flex items-center gap-2">
      {/* Reorder shortcut for low stock alerts */}
      {n.type === "low_stock" && onReorder && (
        <button
          onClick={() => {
            if (!n.isRead) handleMarkRead(n.id);
            onReorder(n.message);
          }}
          className="btn-primary !h-7 !px-2.5 text-xs flex items-center gap-1"
          title="Create purchase stock order for this item"
        >
          <Icon name="plus" size={12} /> Reorder
        </button>
      )}

      {!n.isRead && (
        <button
          onClick={() => handleMarkRead(n.id)}
          className="btn-secondary !h-7 !px-2 text-xs text-blue-600 hover:bg-blue-50"
          title="Mark as Read"
        >
          Mark Read
        </button>
      )}

      <button
        onClick={() => handleDelete(n.id)}
        className="text-slate-400 hover:text-red-600 p-1"
        title="Delete Notification"
      >
        <Icon name="trash" size={16} />
      </button>
    </div>,
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Notifications ({notifications.length})</h1>
        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            <button className="btn-secondary !h-9 text-xs" onClick={handleMarkAllRead}>
              Mark All Read
            </button>
            <button
              className="btn-secondary !h-9 !bg-red-50 !text-red-600 hover:!bg-red-100 border-red-200 text-xs"
              onClick={handleClearAll}
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyText="No notifications at this time."
      />
    </div>
  );
}