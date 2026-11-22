import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { salesApi, type SalesOrderInput } from "@/api/sales";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { ConfirmDialog, EmptyState, ErrorState, PageHeader, Pagination, QueryState, SALES_LABELS, SalesStatusBadge, TableSkeleton } from "@/components/common/common";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useCustomersRef, useProductsRef, useWarehousesRef } from "@/hooks/useReferenceData";
import { applyServerErrors, decimalField } from "@/lib/validation";
import { lineTotal } from "@/lib/decimal";
import { formatAmount, formatDateTime, formatQuantity } from "@/lib/format";
import type { SalesOrder, SalesStatus } from "@/types/api";
import { useAuth } from "@/features/auth/AuthContext";
import { Unauthorized } from "@/routes/guards";

const INVALIDATE = [["sales-orders"], ["stock-levels"], ["stock-movements"], ["dashboard"]];

export function SalesListPage() {
  const { can } = useAuth();
  const customers = useCustomersRef();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<SalesStatus | "">("");
  const [customer, setCustomer] = useState("");
  const [since, setSince] = useState("");
  const params = { page, status, customer, created_at__gte: since ? new Date(since).toISOString() : "" };
  const q = useQuery({ queryKey: ["sales-orders", params], queryFn: () => salesApi.list(params) });
  return (
    <>
      <PageHeader title="Commandes de vente" actions={can("sales.write") && <Link to="/sales-orders/new"><Button><Plus className="h-4 w-4" />Nouvelle commande</Button></Link>} />
      <Card>
        <div className="grid gap-3 border-b p-4 sm:grid-cols-3">
          <Select aria-label="Statut" value={status} onChange={(e) => { setStatus(e.target.value as SalesStatus | ""); setPage(1); }}>
            <option value="">Tous les statuts</option>{(Object.keys(SALES_LABELS) as SalesStatus[]).map((s) => <option key={s} value={s}>{SALES_LABELS[s]}</option>)}
          </Select>
          <Select aria-label="Client" value={customer} onChange={(e) => { setCustomer(e.target.value); setPage(1); }}><option value="">Tous les clients</option>{customers.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Input type="date" aria-label="Créées depuis le" value={since} onChange={(e) => { setSince(e.target.value); setPage(1); }} />
        </div>
        <QueryState query={q} isEmpty={(d) => d.results.length === 0} empty={<EmptyState title="Aucune commande de vente" description="Créez une commande ou modifiez les filtres." />}>
          {(d) => (<>
            <TableWrap><Table>
              <thead><tr><Th>Numéro</Th><Th>Client</Th><Th>Entrepôt</Th><Th>Statut</Th><Th className="text-right">Total</Th><Th>Créée le</Th></tr></thead>
              <tbody>{d.results.map((o) => (
                <tr key={o.id} className="hover:bg-muted/40">
                  <Td><Link to={`/sales-orders/${o.id}`} className="font-medium text-primary hover:underline">{o.number ?? `#${o.id}`}</Link></Td>
                  <Td>{o.customer_name}</Td><Td>{o.warehouse_name}</Td><Td><SalesStatusBadge status={o.status} /></Td>
                  <Td className="text-right tabular-nums">{formatAmount(o.total)}</Td><Td className="text-muted-foreground">{formatDateTime(o.created_at)}</Td>
                </tr>))}</tbody>
            </Table></TableWrap>
            <Pagination page={page} count={d.count} onPage={setPage} />
          </>)}
        </QueryState>
      </Card>
    </>
  );
}

const lineSchema = z.object({ product: z.string().min(1, "Produit requis"), quantity: decimalField({ dp: 3, min: "positive", label: "Quantité" }) });
const formSchema = z.object({
  customer: z.string().min(1, "Choisissez un client"),
  warehouse: z.string().min(1, "Choisissez un entrepôt"),
  notes: z.string(),
  lines: z.array(lineSchema).min(1, "Ajoutez au moins une ligne")
    .refine((ls) => new Set(ls.map((l) => l.product)).size === ls.length, "Un produit ne peut apparaître qu'une fois"),
});
type FormValues = z.infer<typeof formSchema>;

export function SalesFormPage() {
  const { id } = useParams();
  const orderId = id ? Number(id) : null;
  const { can } = useAuth();
  const existing = useQuery({ queryKey: ["sales-orders", "detail", orderId], queryFn: () => salesApi.get(orderId!), enabled: orderId !== null });
  if (!can("sales.write")) return <Unauthorized />;
  if (orderId !== null) {
    if (existing.isPending) return <TableSkeleton />;
    if (existing.isError) return <Card><ErrorState error={existing.error} onRetry={() => existing.refetch()} /></Card>;
    if (existing.data.status !== "DRAFT") return <Card><EmptyState title="Commande non modifiable" description="Seules les commandes en brouillon peuvent être modifiées." action={<Link to={`/sales-orders/${orderId}`} className="text-sm font-medium text-primary">Voir la commande</Link>} /></Card>;
  }
  return <SalesForm order={existing.data ?? null} />;
}

function SalesForm({ order }: { order: SalesOrder | null }) {
  const navigate = useNavigate();
  const customers = useCustomersRef();
  const warehouses = useWarehousesRef();
  const products = useProductsRef();
  const [banner, setBanner] = useState<string | null>(null);
  const { register, control, handleSubmit, watch, setError, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer: order ? String(order.customer) : "", warehouse: order ? String(order.warehouse) : "", notes: order?.notes ?? "",
      lines: order ? order.lines.map((l) => ({ product: String(l.product), quantity: l.quantity })) : [{ product: "", quantity: "1" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = watch("lines");
  const priceOf = (pid: string) => products.items.find((p) => String(p.id) === pid)?.unit_price ?? null;
  const m = useApiMutation(
    (v: FormValues) => {
      const body: SalesOrderInput = { customer: Number(v.customer), warehouse: Number(v.warehouse), notes: v.notes, lines: v.lines.map((l) => ({ product: Number(l.product), quantity: l.quantity })) };
      return order ? salesApi.update(order.id, body) : salesApi.create(body);
    },
    { success: order ? "Brouillon enregistré" : "Brouillon créé", invalidate: [["sales-orders"], ["dashboard"]], silentError: true, onSuccess: (o) => navigate(`/sales-orders/${o.id}`) },
  );
  const activeProducts = products.items.filter((p) => p.is_active);
  return (
    <>
      <PageHeader title={order ? `Modifier ${order.number}` : "Nouvelle commande de vente"} description="Les prix sont figés à la confirmation. Les montants affichés ici sont indicatifs (prix de liste actuels)." />
      <form noValidate onSubmit={handleSubmit((v) => m.mutate(v, { onError: (e) => setBanner(applyServerErrors(e, setError, ["customer", "warehouse", "notes", "lines"])) }))} className="space-y-6">
        {banner && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{banner}</p>}
        <Card><CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Client" error={errors.customer?.message}>{(p) => <Select {...p} {...register("customer")}><option value="">Choisir…</option>{customers.items.filter((c) => c.is_active || String(c.id) === String(order?.customer)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
          <Field label="Entrepôt" error={errors.warehouse?.message}>{(p) => <Select {...p} {...register("warehouse")}><option value="">Choisir…</option>{warehouses.items.filter((w) => w.is_active || String(w.id) === String(order?.warehouse)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select>}</Field>
          <div className="sm:col-span-2"><Field label="Notes" error={errors.notes?.message}>{(p) => <Textarea {...p} {...register("notes")} />}</Field></div>
        </CardContent></Card>
        <Card>
          <CardHeader><CardTitle>Lignes</CardTitle><Button size="sm" variant="outline" onClick={() => append({ product: "", quantity: "1" })}><Plus className="h-4 w-4" />Ajouter une ligne</Button></CardHeader>
          <CardContent className="space-y-3">
            {fields.map((f, i) => (
              <div key={f.id} className="grid items-start gap-3 sm:grid-cols-[1fr_140px_130px_auto]">
                <Field label={i === 0 ? "Produit" : "Produit "}>{(p) => <Select {...p} {...register(`lines.${i}.product` as const)}><option value="">Choisir…</option>{activeProducts.map((x) => <option key={x.id} value={x.id}>{x.sku} — {x.name}</option>)}</Select>}</Field>
                <Field label="Quantité" error={errors.lines?.[i]?.quantity?.message}>{(p) => <Input inputMode="decimal" {...p} {...register(`lines.${i}.quantity` as const)} />}</Field>
                <div className="space-y-1.5"><p className="text-sm font-medium">Total indicatif</p><p className="flex h-9 items-center text-sm tabular-nums">{formatAmount(lineTotal(String(lines?.[i]?.quantity ?? "").replace(",", "."), priceOf(lines?.[i]?.product ?? "")))}</p></div>
                <Button variant="ghost" size="icon" className="mt-6" aria-label="Supprimer la ligne" onClick={() => remove(i)} disabled={fields.length === 1}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {(errors.lines?.message || errors.lines?.root?.message) && <p role="alert" className="text-xs text-destructive">{errors.lines?.message ?? errors.lines?.root?.message}</p>}
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => navigate(-1)}>Annuler</Button><Button type="submit" loading={m.isPending}>Enregistrer le brouillon</Button></div>
      </form>
    </>
  );
}

type Action = "confirm" | "ship" | "cancel" | "delete";
const ACTION_TEXT: Record<Action, { title: string; message: string; label: string; destructive?: boolean; success: string }> = {
  confirm: { title: "Confirmer la commande", message: "Le stock sera réservé et les prix unitaires figés. Cette action déclenche des mouvements de stock.", label: "Confirmer", success: "Commande confirmée" },
  ship: { title: "Expédier la commande", message: "Le stock physique sera diminué et les réservations libérées.", label: "Expédier", success: "Commande expédiée" },
  cancel: { title: "Annuler la commande", message: "Une commande confirmée verra son stock réservé libéré. Action irréversible.", label: "Annuler la commande", destructive: true, success: "Commande annulée" },
  delete: { title: "Supprimer le brouillon", message: "Le brouillon sera définitivement supprimé.", label: "Supprimer", destructive: true, success: "Brouillon supprimé" },
};

export function SalesDetailPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const navigate = useNavigate();
  const { can } = useAuth();
  const [action, setAction] = useState<Action | null>(null);
  const q = useQuery({ queryKey: ["sales-orders", "detail", orderId], queryFn: () => salesApi.get(orderId) });
  // Les transitions passent TOUJOURS par les endpoints dédiés : la logique métier reste dans Django.
  const run = useApiMutation((a: Action) => ({ confirm: salesApi.confirm, ship: salesApi.ship, cancel: salesApi.cancel, delete: salesApi.remove })[a](orderId) as Promise<unknown>, {
    success: () => ACTION_TEXT[action ?? "confirm"].success, invalidate: INVALIDATE,
    onSuccess: () => { const a = action; setAction(null); if (a === "delete") navigate("/sales-orders"); },
  });
  return (
    <QueryState query={q}>
      {(o) => {
        const write = can("sales.write");
        const showTotal = o.total !== null;
        return (
          <>
            <PageHeader title={o.number ?? `Commande #${o.id}`} description={`${o.customer_name} · ${o.warehouse_name}`}
              actions={<>
                <SalesStatusBadge status={o.status} />
                {write && o.status === "DRAFT" && <><Link to={`/sales-orders/${o.id}/edit`}><Button variant="outline">Modifier</Button></Link><Button onClick={() => setAction("confirm")}>Confirmer</Button><Button variant="ghost" className="text-destructive" onClick={() => setAction("delete")}>Supprimer</Button></>}
                {can("sales.ship") && o.status === "CONFIRMED" && <Button onClick={() => setAction("ship")}>Expédier</Button>}
                {write && (o.status === "DRAFT" || o.status === "CONFIRMED") && <Button variant="outline" onClick={() => setAction("cancel")}>Annuler</Button>}
              </>} />
            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
              <Card>
                <CardHeader><CardTitle>Lignes de la commande</CardTitle></CardHeader>
                <TableWrap><Table>
                  <thead><tr><Th>Produit</Th><Th className="text-right">Quantité</Th><Th className="text-right">Prix unitaire</Th><Th className="text-right">Total ligne</Th></tr></thead>
                  <tbody>{o.lines.map((l) => <tr key={l.id}><Td className="font-medium">{l.product_name}</Td><Td className="text-right tabular-nums">{formatQuantity(l.quantity)}</Td><Td className="text-right tabular-nums">{l.unit_price === null ? <span className="text-muted-foreground">à la confirmation</span> : formatAmount(l.unit_price)}</Td><Td className="text-right tabular-nums">{formatAmount(l.line_total)}</Td></tr>)}</tbody>
                  <tfoot><tr><Td colSpan={3} className="text-right font-medium">Total</Td><Td className="text-right text-base font-semibold tabular-nums">{showTotal ? formatAmount(o.total) : "—"}</Td></tr></tfoot>
                </Table></TableWrap>
                {!showTotal && <p className="px-5 pb-4 text-xs text-muted-foreground">Le total sera calculé à la confirmation, quand les prix sont figés.</p>}
              </Card>
              <Card><CardHeader><CardTitle>Informations</CardTitle></CardHeader><CardContent>
                <dl className="space-y-3 text-sm">
                  <div><dt className="text-muted-foreground">Créée le</dt><dd>{formatDateTime(o.created_at)}</dd></div>
                  <div><dt className="text-muted-foreground">Confirmée le</dt><dd>{formatDateTime(o.confirmed_at)}</dd></div>
                  <div><dt className="text-muted-foreground">Expédiée le</dt><dd>{formatDateTime(o.shipped_at)}</dd></div>
                  {o.cancelled_at && <div><dt className="text-muted-foreground">Annulée le</dt><dd>{formatDateTime(o.cancelled_at)}</dd></div>}
                  <div><dt className="text-muted-foreground">Notes</dt><dd className="whitespace-pre-line">{o.notes || "—"}</dd></div>
                </dl>
              </CardContent></Card>
            </div>
            {action && <ConfirmDialog open title={ACTION_TEXT[action].title} message={ACTION_TEXT[action].message} confirmLabel={ACTION_TEXT[action].label} destructive={ACTION_TEXT[action].destructive} loading={run.isPending} onClose={() => setAction(null)} onConfirm={() => run.mutate(action)} />}
          </>
        );
      }}
    </QueryState>
  );
}
