import type { ReactNode } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Badge, Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { normalizeError } from "@/lib/errors";
import type { PurchaseStatus, SalesStatus } from "@/types/api";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = normalizeError(error);
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
      <p className="text-sm font-medium">Impossible de charger les données</p>
      <p className="text-sm text-muted-foreground">{e.message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Réessayer</Button>}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
    </div>
  );
}

/** Rend : squelette → erreur → vide → contenu. Évite de répéter ce schéma dans chaque page. */
export function QueryState<T>({
  query,
  isEmpty,
  empty,
  children,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; data: T | undefined; refetch: () => unknown };
  isEmpty?: (d: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <TableSkeleton />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data === undefined) return null;
  if (isEmpty?.(query.data)) return <>{empty ?? <EmptyState title="Aucun résultat" />}</>;
  return <>{children(query.data)}</>;
}

export const PAGE_SIZE = 20;

export function Pagination({ page, count, onPage, pageSize = PAGE_SIZE }: { page: number; count: number; onPage: (p: number) => void; pageSize?: number }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (count <= pageSize) return count ? <p className="px-4 py-3 text-xs text-muted-foreground">{count} résultat{count > 1 ? "s" : ""}</p> : null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between px-4 py-3">
      <p className="text-xs text-muted-foreground">{count} résultats — page {page} / {pages}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" />Précédent</Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Suivant<ChevronRight className="h-4 w-4" /></Button>
      </div>
    </nav>
  );
}

export function ConfirmDialog({
  open, title, message, confirmLabel = "Confirmer", destructive, loading, onConfirm, onClose,
}: {
  open: boolean; title: string; message: ReactNode; confirmLabel?: string; destructive?: boolean; loading?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-5">
        <div className="text-sm text-muted-foreground">{message}</div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button variant={destructive ? "destructive" : "default"} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}

const SALES: Record<SalesStatus, [string, "neutral" | "info" | "success" | "danger"]> = {
  DRAFT: ["Brouillon", "neutral"], CONFIRMED: ["Confirmée", "info"], SHIPPED: ["Expédiée", "success"], CANCELLED: ["Annulée", "danger"],
};
const PURCHASE: Record<PurchaseStatus, [string, "neutral" | "info" | "warning" | "success" | "danger"]> = {
  DRAFT: ["Brouillon", "neutral"], ORDERED: ["Commandée", "info"], PARTIALLY_RECEIVED: ["Partiellement reçue", "warning"], RECEIVED: ["Reçue", "success"], CANCELLED: ["Annulée", "danger"],
};
export const SALES_LABELS = Object.fromEntries(Object.entries(SALES).map(([k, v]) => [k, v[0]])) as Record<SalesStatus, string>;
export const PURCHASE_LABELS = Object.fromEntries(Object.entries(PURCHASE).map(([k, v]) => [k, v[0]])) as Record<PurchaseStatus, string>;

export function SalesStatusBadge({ status }: { status: SalesStatus }) {
  return <Badge tone={SALES[status][1]}>{SALES[status][0]}</Badge>;
}
export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  return <Badge tone={PURCHASE[status][1]}>{PURCHASE[status][0]}</Badge>;
}
export function ActiveBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? "success" : "neutral"}>{active ? "Actif" : "Inactif"}</Badge>;
}
