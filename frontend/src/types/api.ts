import type { Role } from "@/lib/permissions";

/** Décimal sérialisé en chaîne par DRF (ex. "25.000"). Ne jamais utiliser comme number. */
export type Dec = string;

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Me {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: Role;
  is_active: boolean;
}

export interface User extends Me {
  date_joined: string;
}

export interface Partner {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category { id: number; name: string; created_at: string; updated_at: string }

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string;
  category: number;
  category_name: string;
  unit_price: Dec;
  is_active: boolean;
  reorder_level: Dec;
  created_at: string;
  updated_at: string;
}

export interface Warehouse { id: number; code: string; name: string; is_active: boolean }

export interface StockLevel {
  id: number;
  product: number;
  warehouse: number;
  on_hand: Dec;
  reserved: Dec;
  available: Dec;
  updated_at: string;
}

export type MovementType = "RECEIPT" | "SHIPMENT" | "RESERVE" | "RELEASE" | "ADJUSTMENT";

export interface StockMovement {
  id: number;
  product: number;
  warehouse: number;
  movement_type: MovementType;
  on_hand_delta: Dec;
  reserved_delta: Dec;
  reference: string;
  reason: string;
  created_by: number;
  created_at: string;
}

export type SalesStatus = "DRAFT" | "CONFIRMED" | "SHIPPED" | "CANCELLED";

export interface SalesOrderLine {
  id: number;
  product: number;
  product_name: string;
  quantity: Dec;
  unit_price: Dec | null;
  line_total: Dec | null;
}

export interface SalesOrder {
  id: number;
  number: string | null;
  customer: number;
  customer_name: string;
  warehouse: number;
  warehouse_name: string;
  status: SalesStatus;
  notes: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  cancelled_at: string | null;
  lines: SalesOrderLine[];
  total: Dec | null;
}

export type PurchaseStatus = "DRAFT" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

export interface PurchaseOrderLine {
  id: number;
  product: number;
  product_name: string;
  product_sku: string;
  quantity_ordered: Dec;
  quantity_received: Dec;
  quantity_remaining: Dec;
  unit_cost: Dec;
}

export interface PurchaseOrder {
  id: number;
  number: string;
  supplier: number;
  supplier_name: string;
  warehouse: number;
  warehouse_name: string;
  status: PurchaseStatus;
  ordered_at: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  lines: PurchaseOrderLine[];
}

export interface ReceiptLine {
  id: number;
  purchase_order_line: number;
  product_name: string;
  product_sku: string;
  quantity: Dec;
}

export interface Receipt {
  id: number;
  purchase_order: number;
  purchase_order_number: string;
  idempotency_key: string;
  received_by: number;
  created_at: string;
  lines: ReceiptLine[];
}

export interface DashboardSummary {
  products_count: number;
  active_products_count: number;
  categories_count: number;
  customers_count: number;
  suppliers_count: number;
  warehouses_count: number;
  products_out_of_stock: number;
  products_low_stock: number;
  stock_value_at_list_price: Dec;
  sales_orders_by_status: Partial<Record<SalesStatus, number>>;
  purchase_orders_by_status: Partial<Record<PurchaseStatus, number>>;
}

export interface AuditLog {
  id: number;
  actor: number | null;
  actor_email: string | null;
  action: string;
  object_type: string;
  object_id: number;
  payload: Record<string, unknown>;
  created_at: string;
}
