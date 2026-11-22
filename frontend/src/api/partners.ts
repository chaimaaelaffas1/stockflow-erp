import type { Paginated, Partner } from "@/types/api";
import { api, clean } from "./client";

export interface PartnerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string;
  is_active: boolean;
}
export interface PartnerParams {
  page?: number;
  search?: string;
  is_active?: string;
  ordering?: string;
  page_size?: number;
}

export type PartnerKind = "customers" | "suppliers";

export const partnersApi = (kind: PartnerKind) => ({
  list: (params: PartnerParams = {}) =>
    api.get<Paginated<Partner>>(`/partners/${kind}/`, { params: clean({ ...params }) }).then((r) => r.data),
  get: (id: number) => api.get<Partner>(`/partners/${kind}/${id}/`).then((r) => r.data),
  create: (body: PartnerInput) => api.post<Partner>(`/partners/${kind}/`, body).then((r) => r.data),
  update: (id: number, body: Partial<PartnerInput>) =>
    api.patch<Partner>(`/partners/${kind}/${id}/`, body).then((r) => r.data),
  remove: (id: number) => api.delete(`/partners/${kind}/${id}/`).then(() => undefined),
});
export const customersApi = partnersApi("customers");
export const suppliersApi = partnersApi("suppliers");
