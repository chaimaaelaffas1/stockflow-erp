import type { MovementType, Paginated, StockLevel, StockMovement, Warehouse } from "@/types/api";
import { api, clean } from "./client";

export interface WarehouseInput { code: string; name: string; is_active: boolean }
export interface StockLevelParams {
  page?: number;
  product?: string;
  warehouse?: string;
  low_stock?: "true";
  threshold?: string;
}
export interface MovementParams {
  page?: number;
  product?: string;
  warehouse?: string;
  movement_type?: MovementType | "";
  created_at__gte?: string;
}
export interface AdjustmentInput { product: number; warehouse: number; quantity_delta: string; reason: string }

export const warehousesApi = {
  list: (params: { page?: number; page_size?: number } = {}) =>
    api.get<Paginated<Warehouse>>("/inventory/warehouses/", { params: clean(params) }).then((r) => r.data),
  get: (id: number) => api.get<Warehouse>(`/inventory/warehouses/${id}/`).then((r) => r.data),
  create: (body: WarehouseInput) => api.post<Warehouse>("/inventory/warehouses/", body).then((r) => r.data),
  update: (id: number, body: Partial<WarehouseInput>) =>
    api.patch<Warehouse>(`/inventory/warehouses/${id}/`, body).then((r) => r.data),
};

export const stockApi = {
  levels: (params: StockLevelParams = {}) =>
    api.get<Paginated<StockLevel>>("/inventory/stock-levels/", { params: clean({ ...params }) }).then((r) => r.data),
  movements: (params: MovementParams = {}) =>
    api.get<Paginated<StockMovement>>("/inventory/stock-movements/", { params: clean({ ...params }) }).then((r) => r.data),
  adjust: (body: AdjustmentInput) =>
    api.post<StockMovement>("/inventory/stock-adjustments/", body).then((r) => r.data),
};
