// Shared TypeScript types used across components, features and services.

// Names of every icon available in <Icon />
export type IconName =
  | "activity"
  | "alert"
  | "bell"
  | "box"
  | "calendar"
  | "cart"
  | "chevron"
  | "clipboard"
  | "close"
  | "dashboard"
  | "download"
  | "edit"
  | "logout"
  | "menu"
  | "more"
  | "orders"
  | "plus"
  | "search"
  | "settings"
  | "suppliers"
  | "trash"
  | "trend"
  | "upload"
  | "users"
  | "home"
  | "warehouse"
  | "cubes"
  | "file"
  | "hourglass"
  | "eye"
  | "eyeoff"
  | "image";

// Function used to show a toast message to the user
export type Notify = (message: string) => void;

// Access level stored in the Supabase `profiles` table
export type Role = "admin" | "employee";

// Signed-in user (auth session + profile row)
export type AuthUser = { id: string; email: string; name: string; initials: string; role: Role };

export type StockStatus = "In Stock" | "Low Stock" | "Out of Stock";

// A row of the `products` table, in camelCase
export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string;
  price: number;
  cost?: number;         
  supplierName?: string; 
  stock: number;
  lowStockAlert: number;
  createdAt: string;
};

// Data entered in the add / edit product form
export type ProductInput = Omit<Product, "id" | "sku" | "createdAt">;

export type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  productId?: string | null;
  productName?: string;
  quantity: number;
  status: string;
  total: number;
  createdAt: string;
  assignedTo: string | null;
};

// Represents a product item offered by a supplier via supplier_products junction table
export type SupplierProduct = {
  id: string;
  supplierId: string;
  productId: string;
  productName?: string;
  unitPrice: number;
};

export type Supplier = {
  id: string;
  name: string;
  contactEmail: string;
  category: string;
  status: string;
  products?: SupplierProduct[];
};

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  supplierName: string;
  productId?: string | null;
  productName?: string;
  quantity: number;
  amount: number;
  status: string;
  expectedDate: string | null;
  createdAt: string;
};

export type TxType = "IN" | "OUT" | "ADJUST";

export type InventoryTransaction = {
  id: string;
  productName: string;
  type: TxType;
  quantity: number;
  reference: string;
  remarks: string;
  createdAt: string;
};

export type NotificationType = "low_stock" | "order" | "purchase_order" | "deadline";

export type AppNotification = { id: string; type: NotificationType; title: string; message: string; isRead: boolean; createdAt: string };

export type Profile = { id: string; email: string; fullName: string; role: Role; createdAt: string };