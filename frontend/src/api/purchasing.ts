import type { Paginated, PurchaseOrder, Receipt } from "@/types/api";
import { api, clean } from "./client";

export interface PurchaseOrderInput {
  supplier: number;
  warehouse: number;
  lines: { product: number; quantity_ordered: string; unit_cost: string }[];
}
export interface ReceiveInput {
  idempotency_key: string;
  lines: { purchase_order_line: number; quantity: string }[];
}

export const purchasingApi = {
  list: (params: { page?: number; page_size?: number; ordering?: string } = {}) =>
    api.get<Paginated<PurchaseOrder>>("/purchasing/purchase-orders/", { params: clean(params) }).then((r) => r.data),
  get: (id: number) => api.get<PurchaseOrder>(`/purchasing/purchase-orders/${id}/`).then((r) => r.data),
  // Écart backend : create/update renvoient la forme « écriture » (sans number/status).
  // Le hook de mutation invalide donc les caches ; on ne s'appuie pas sur cette réponse.
  create: (body: PurchaseOrderInput) =>
    api.post<{ id: number }>("/purchasing/purchase-orders/", body).then((r) => r.data),
  update: (id: number, body: PurchaseOrderInput) =>
    api.put<{ id: number }>(`/purchasing/purchase-orders/${id}/`, body).then((r) => r.data),
  remove: (id: number) => api.delete(`/purchasing/purchase-orders/${id}/`).then(() => undefined),
  place: (id: number) => api.post<PurchaseOrder>(`/purchasing/purchase-orders/${id}/place/`).then((r) => r.data),
  cancel: (id: number) => api.post<PurchaseOrder>(`/purchasing/purchase-orders/${id}/cancel/`).then((r) => r.data),
  receive: (id: number, body: ReceiveInput) =>
    api.post<Receipt>(`/purchasing/purchase-orders/${id}/receive/`, body).then((r) => ({ receipt: r.data, replayed: r.status === 200 })),
  receipts: (params: { page?: number; page_size?: number } = {}) =>
    api.get<Paginated<Receipt>>("/purchasing/receipts/", { params: clean(params) }).then((r) => r.data),
};
