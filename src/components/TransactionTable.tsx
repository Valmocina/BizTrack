// Table of stock movements (Date, Product, Type, Quantity, Reference, Remarks). Used on the dashboard and Inventory page.
import { DataTable } from "@/components/ui/DataTable";
import { Pill } from "@/components/ui/Pill";
import { formatDate } from "@/services/format";
import type { InventoryTransaction, TxType } from "@/types";

const tone: Record<TxType, "green" | "red" | "orange"> = { IN: "green", OUT: "red", ADJUST: "orange" };

export function TransactionTable({ transactions, loading, footer }: { transactions: InventoryTransaction[]; loading: boolean; footer?: React.ReactNode }) {
  return (
    <DataTable
      columns={["Date", "Product", "Type", "Quantity", "Reference", "Remarks"]}
      rows={transactions.map((t) => [formatDate(t.createdAt), t.productName, <Pill tone={tone[t.type]}>{t.type}</Pill>, t.quantity, t.reference || "—", t.remarks || "—"])}
      loading={loading}
      emptyText="No inventory movements yet."
      footer={footer}
    />
  );
}
