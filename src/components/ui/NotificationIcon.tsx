// Round colored icon that matches a notification type.
import { Icon } from "@/components/ui/Icon";
import type { IconName, NotificationType } from "@/types";

const styles: Record<NotificationType, { icon: IconName; tint: string }> = {
  low_stock: { icon: "alert", tint: "bg-red-100 text-red-500" },
  purchase_order: { icon: "file", tint: "bg-blue-100 text-blue-500" },
  deadline: { icon: "hourglass", tint: "bg-orange-100 text-orange-500" },
  order: { icon: "cart", tint: "bg-emerald-100 text-emerald-500" },
};

export function NotificationIcon({ type, size = 24, box = 50 }: { type: NotificationType; size?: number; box?: number }) {
  const style = styles[type];
  return <span className={`grid shrink-0 place-items-center rounded-full ${style.tint}`} style={{ width: box, height: box }}><Icon name={style.icon} size={size} /></span>;
}
