import {
  listPurchaseOrders,
  receivedPurchaseAmount,
} from "@/services/purchaseOrderService";
import { listOrders } from "@/services/orderService";

export type FinancialSummary = {
  totalSpent: number;
  totalRevenue: number;
  netProfit: number;
  profitMargin: number;
};

export async function getFinancialSummary(): Promise<FinancialSummary> {
  const [pos, orders] = await Promise.all([
    listPurchaseOrders(),
    listOrders(),
  ]);

  const totalSpent = pos
    .filter((p) => p.receivedQuantity > 0)
    .reduce((sum, p) => sum + receivedPurchaseAmount(p), 0);

  const totalRevenue = orders
    .filter((o) => o.status === "Completed")
    .reduce((sum, o) => sum + o.total, 0);

  const netProfit = totalRevenue - totalSpent;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return { totalSpent, totalRevenue, netProfit, profitMargin };
}
