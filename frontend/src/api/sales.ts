import type { Paginated, SalesOrder, SalesStatus } from "@/types/api";
import { api, clean } from "./client";

export interface SalesOrderInput {
  customer: number;
  warehouse: number;
  notes?: string;
  lines: { product: number; quantity: string }[];
}
export interface SalesParams {
  page?: number;
  status?: SalesStatus | "";
  customer?: string;
  created_at__gte?: string;
  ordering?: string;
}

export const salesApi = {
  list: (params: SalesParams = {}) =>
    api.get<Paginated<SalesOrder>>("/sales/sales-orders/", { params: clean({ ...params }) }).then((r) => r.data),
  get: (id: number) => api.get<SalesOrder>(`/sales/sales-orders/${id}/`).then((r) => r.data),
  create: (body: SalesOrderInput) => api.post<SalesOrder>("/sales/sales-orders/", body).then((r) => r.data),
  // PUT : le serializer exige `lines` ; on envoie toujours le brouillon complet.
  update: (id: number, body: SalesOrderInput) =>
    api.put<SalesOrder>(`/sales/sales-orders/${id}/`, body).then((r) => r.data),
  remove: (id: number) => api.delete(`/sales/sales-orders/${id}/`).then(() => undefined),
  confirm: (id: number) => api.post<SalesOrder>(`/sales/sales-orders/${id}/confirm/`).then((r) => r.data),
  ship: (id: number) => api.post<SalesOrder>(`/sales/sales-orders/${id}/ship/`).then((r) => r.data),
  cancel: (id: number) => api.post<SalesOrder>(`/sales/sales-orders/${id}/cancel/`).then((r) => r.data),
};
