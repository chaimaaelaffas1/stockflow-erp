import type { AuditLog, DashboardSummary, Paginated } from "@/types/api";
import { api, clean } from "./client";

export const dashboardApi = {
  summary: () => api.get<DashboardSummary>("/dashboard/summary/").then((r) => r.data),
};

export interface AuditParams { page?: number; action?: string; object_type?: string; object_id?: string; actor?: string }
export const auditApi = {
  list: (params: AuditParams = {}) =>
    api.get<Paginated<AuditLog>>("/dashboard/audit-logs/", { params: clean({ ...params }) }).then((r) => r.data),
};
