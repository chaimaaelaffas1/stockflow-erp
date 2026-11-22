import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { purchasingApi, type PurchaseOrderInput } from "@/api/purchasing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { ConfirmDialog, EmptyState, ErrorState, PageHeader, Pagination, PURCHASE_LABELS, PurchaseStatusBadge, QueryState, TableSkeleton } from "@/components/common/common";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useProductsRef, useSuppliersRef, useWarehousesRef } from "@/hooks/useReferenceData";
import { applyServerErrors, decimalField } from "@/lib/validation";
import { lineTotal, sumDecimals, toScaled } from "@/lib/decimal";
import { formatAmount, formatDateTime, formatQuantity } from "@/lib/format";
import { normalizeError } from "@/lib/errors";
import { uuid } from "@/lib/uuid";
import type { PurchaseOrder, PurchaseStatus } from "@/types/api";
import { useAuth } from "@/features/auth/AuthContext";
import { Unauthorized } from "@/routes/guards";

const INVALIDATE = [["purchase-orders"], ["receipts"], ["stock-levels"], ["stock-movements"], ["dashboard"]];
const orderTotal = (o: PurchaseOrder) => sumDecimals(o.lines.map((l) => lineTotal(l.quantity_ordered, l.unit_cost)));

export function PurchaseListPage() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PurchaseStatus | "">("");
  const q = useQuery({ queryKey: ["purchase-orders", { page }], queryFn: () => purchasingApi.list({ page }) });
  return (
    <>
      <PageHeader title="Commandes d'achat" actions={can("purchasing.write") && <Link to="/purchase-orders/new"><Button><Plus className="h-4 w-4" />Nouvelle commande</Button></Link>} />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <Select className="w-56" aria-label="Statut" value={status} onChange={(e) => setStatus(e.target.value as PurchaseStatus | "")}>
            <option value="">Tous les statuts</option>{(Object.keys(PURCHASE_LABELS) as PurchaseStatus[]).map((s) => <option key={s} value={s}>{PURCHASE_LABELS[s]}</option>)}
          </Select>
          {status && <p className="text-xs text-muted-foreground">L'API ne filtre pas par statut : le filtre s'applique à la page affichée.</p>}
        </div>
        <QueryState query={q} isEmpty={(d) => d.results.length === 0} empty={<EmptyState title="Aucune commande d'achat" />}>
          {(d) => {
            const rows = status ? d.results.filter((o) => o.status === status) : d.results;
            return (<>
              {rows.length === 0 ? <EmptyState title="Aucune commande avec ce statut sur cette page" /> : (
                <TableWrap><Table>
                  <thead><tr><Th>Numéro</Th><Th>Fournisseur</Th><Th>Entrepôt</Th><Th>Statut</Th><Th className="text-right">Total</Th><Th>Créée le</Th></tr></thead>
                  <tbody>{rows.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/40">
                      <Td><Link to={`/purchase-orders/${o.id}`} className="font-mono text-xs font-medium text-primary hover:underline">{o.number}</Link></Td>
                      <Td>{o.supplier_name}</Td><Td>{o.warehouse_name}</Td><Td><PurchaseStatusBadge status={o.status} /></Td>
                      <Td className="text-right tabular-nums">{formatAmount(orderTotal(o))}</Td><Td className="text-muted-foreground">{formatDateTime(o.created_at)}</Td>
                    </tr>))}</tbody>
                </Table></TableWrap>)}
              <Pagination page={page} count={d.count} onPage={setPage} />
            </>);
          }}
        </QueryState>
      </Card>
    </>
  );
}

const lineSchema = z.object({ product: z.string().min(1, "Produit requis"), quantity_ordered: decimalField({ dp: 3, min: "positive", label: "Quantité" }), unit_cost: decimalField({ dp: 2, label: "Coût" }) });
const formSchema = z.object({
  supplier: z.string().min(1, "Choisissez un fournisseur"),
  warehouse: z.string().min(1, "Choisissez un entrepôt"),
  lines: z.array(lineSchema).refine((ls) => new Set(ls.map((l) => l.product)).size === ls.length, "Un produit ne peut apparaître qu'une fois"),
});
type FormValues = z.infer<typeof formSchema>;

export function PurchaseFormPage() {
  const { id } = useParams();
  const orderId = id ? Number(id) : null;
  const { can } = useAuth();
  const existing = useQuery({ queryKey: ["purchase-orders", "detail", orderId], queryFn: () => purchasingApi.get(orderId!), enabled: orderId !== null });
  if (!can("purchasing.write")) return <Unauthorized />;
  if (orderId !== null) {
    if (existing.isPending) return <TableSkeleton />;
    if (existing.isError) return <Card><ErrorState error={existing.error} onRetry={() => existing.refetch()} /></Card>;
    if (existing.data.status !== "DRAFT") return <Card><EmptyState title="Commande non modifiable" description="Seules les commandes en brouillon peuvent être modifiées." action={<Link to={`/purchase-orders/${orderId}`} className="text-sm font-medium text-primary">Voir la commande</Link>} /></Card>;
  }
  return <PurchaseForm order={existing.data ?? null} />;
}

function PurchaseForm({ order }: { order: PurchaseOrder | null }) {
  const navigate = useNavigate();
  const suppliers = useSuppliersRef();
  const warehouses = useWarehousesRef();
  const products = useProductsRef();
  const [banner, setBanner] = useState<string | null>(null);
  const { register, control, handleSubmit, watch, setError, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplier: order ? String(order.supplier) : "", warehouse: order ? String(order.warehouse) : "",
      lines: order ? order.lines.map((l) => ({ product: String(l.product), quantity_ordered: l.quantity_ordered, unit_cost: l.unit_cost })) : [{ product: "", quantity_ordered: "1", unit_cost: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = watch("lines");
  const m = useApiMutation(
    (v: FormValues) => {
      const body: PurchaseOrderInput = { supplier: Number(v.supplier), warehouse: Number(v.warehouse), lines: v.lines.map((l) => ({ product: Number(l.product), quantity_ordered: l.quantity_ordered, unit_cost: l.unit_cost })) };
      return order ? purchasingApi.update(order.id, body) : purchasingApi.create(body);
    },
    // La réponse d'écriture ne contient ni number ni status : on navigue vers le détail, qui refait un GET.
    { success: order ? "Brouillon enregistré" : "Brouillon créé", invalidate: [["purchase-orders"], ["dashboard"]], silentError: true, onSuccess: (o) => navigate(`/purchase-orders/${o.id}`) },
  );
  return (
    <>
      <PageHeader title={order ? `Modifier ${order.number}` : "Nouvelle commande d'achat"} description="Une commande peut être enregistrée sans ligne, mais ne pourra être passée qu'avec au moins une ligne." />
      <form noValidate onSubmit={handleSubmit((v) => m.mutate(v, { onError: (e) => setBanner(applyServerErrors(e, setError, ["supplier", "warehouse", "lines"])) }))} className="space-y-6">
        {banner && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{banner}</p>}
        <Card><CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Fournisseur" error={errors.supplier?.message}>{(p) => <Select {...p} {...register("supplier")}><option value="">Choisir…</option>{suppliers.items.filter((s) => s.is_active || String(s.id) === String(order?.supplier)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}</Field>
          <Field label="Entrepôt de réception" error={errors.warehouse?.message}>{(p) => <Select {...p} {...register("warehouse")}><option value="">Choisir…</option>{warehouses.items.filter((w) => w.is_active || String(w.id) === String(order?.warehouse)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select>}</Field>
        </CardContent></Card>
        <Card>
          <CardHeader><CardTitle>Lignes</CardTitle><Button size="sm" variant="outline" onClick={() => append({ product: "", quantity_ordered: "1", unit_cost: "" })}><Plus className="h-4 w-4" />Ajouter une ligne</Button></CardHeader>
          <CardContent className="space-y-3">
            {fields.length === 0 && <p className="text-sm text-muted-foreground">Aucune ligne pour le moment.</p>}
            {fields.map((f, i) => (
              <div key={f.id} className="grid items-start gap-3 sm:grid-cols-[1fr_120px_120px_120px_auto]">
                <Field label="Produit" error={errors.lines?.[i]?.product?.message}>{(p) => <Select {...p} {...register(`lines.${i}.product` as const)}><option value="">Choisir…</option>{products.items.filter((x) => x.is_active).map((x) => <option key={x.id} value={x.id}>{x.sku} — {x.name}</option>)}</Select>}</Field>
                <Field label="Quantité" error={errors.lines?.[i]?.quantity_ordered?.message}>{(p) => <Input inputMode="decimal" {...p} {...register(`lines.${i}.quantity_ordered` as const)} />}</Field>
                <Field label="Coût unitaire" error={errors.lines?.[i]?.unit_cost?.message}>{(p) => <Input inputMode="decimal" {...p} {...register(`lines.${i}.unit_cost` as const)} />}</Field>
                <div className="space-y-1.5"><p className="text-sm font-medium">Total</p><p className="flex h-9 items-center text-sm tabular-nums">{formatAmount(lineTotal(String(lines?.[i]?.quantity_ordered ?? "").replace(",", "."), String(lines?.[i]?.unit_cost ?? "").replace(",", ".")))}</p></div>
                <Button variant="ghost" size="icon" className="mt-6" aria-label="Supprimer la ligne" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {errors.lines?.message && <p role="alert" className="text-xs text-destructive">{errors.lines.message}</p>}
            {errors.lines?.root?.message && <p role="alert" className="text-xs text-destructive">{errors.lines.root.message}</p>}
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => navigate(-1)}>Annuler</Button><Button type="submit" loading={m.isPending}>Enregistrer le brouillon</Button></div>
      </form>
    </>
  );
}

function ReceiveModal({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  // Une clé d'idempotence par tentative. Elle est conservée en cas d'échec réseau (la requête a pu aboutir :
  // un rejeu avec la même clé ne double-compte pas) et régénérée quand le serveur a répondu définitivement.
  const [key, setKey] = useState(uuid);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [errs, setErrs] = useState<Record<number, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const open = order.lines.filter((l) => (toScaled(l.quantity_remaining) ?? 0n) > 0n);
  const m = useApiMutation((body: { lines: { purchase_order_line: number; quantity: string }[] }) => purchasingApi.receive(order.id, { idempotency_key: key, lines: body.lines }), {
    success: (r) => (r.replayed ? "Réception déjà enregistrée (rejeu idempotent)" : "Réception enregistrée"), invalidate: INVALIDATE, silentError: true, onSuccess: onClose,
  });
  const submit = () => {
    const next: Record<number, string> = {};
    const lines: { purchase_order_line: number; quantity: string }[] = [];
    for (const l of open) {
      const raw = (qty[l.id] ?? "").trim().replace(",", ".");
      if (!raw) continue;
      const n = toScaled(raw);
      if (!/^\d+(\.\d{1,3})?$/.test(raw) || n === null || n <= 0n) next[l.id] = "Quantité invalide";
      else if (n > (toScaled(l.quantity_remaining) ?? 0n)) next[l.id] = `Maximum ${formatQuantity(l.quantity_remaining)}`;
      else lines.push({ purchase_order_line: l.id, quantity: raw });
    }
    setErrs(next);
    if (Object.keys(next).length) return;
    if (!lines.length) return setBanner("Saisissez au moins une quantité à réceptionner.");
    setBanner(null);
    m.mutate({ lines }, { onError: (e) => { const err = normalizeError(e); setBanner(err.message); if (err.status !== null) setKey(uuid()); } });
  };
  return (
    <Modal open onClose={onClose} title={`Réceptionner ${order.number}`} wide>
      <div className="space-y-4">
        {banner && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{banner}</p>}
        <TableWrap><Table>
          <thead><tr><Th>Produit</Th><Th className="text-right">Commandé</Th><Th className="text-right">Déjà reçu</Th><Th className="text-right">Restant</Th><Th className="w-40">À recevoir</Th></tr></thead>
          <tbody>{open.map((l) => (
            <tr key={l.id}><Td><span className="font-medium">{l.product_name}</span> <span className="font-mono text-xs text-muted-foreground">{l.product_sku}</span></Td>
              <Td className="text-right tabular-nums">{formatQuantity(l.quantity_ordered)}</Td><Td className="text-right tabular-nums">{formatQuantity(l.quantity_received)}</Td><Td className="text-right tabular-nums">{formatQuantity(l.quantity_remaining)}</Td>
              <Td><Input inputMode="decimal" aria-label={`Quantité reçue ${l.product_name}`} aria-invalid={!!errs[l.id]} value={qty[l.id] ?? ""} onChange={(e) => setQty((s) => ({ ...s, [l.id]: e.target.value }))} />{errs[l.id] && <p role="alert" className="mt-1 text-xs text-destructive">{errs[l.id]}</p>}</Td></tr>))}</tbody>
        </Table></TableWrap>
        <p className="text-xs text-muted-foreground">Clé d'idempotence : <span className="font-mono">{key}</span></p>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Annuler</Button><Button loading={m.isPending} onClick={submit}>Enregistrer la réception</Button></div>
      </div>
    </Modal>
  );
}

type Action = "place" | "cancel" | "delete";
const TEXT: Record<Action, { title: string; message: string; label: string; destructive?: boolean; success: string }> = {
  place: { title: "Passer la commande", message: "La commande passera au statut « Commandée » et ne sera plus modifiable. Aucun mouvement de stock n'est créé à cette étape.", label: "Passer la commande", success: "Commande passée" },
  cancel: { title: "Annuler la commande", message: "Possible uniquement si rien n'a été reçu.", label: "Annuler la commande", destructive: true, success: "Commande annulée" },
  delete: { title: "Supprimer le brouillon", message: "Le brouillon sera définitivement supprimé.", label: "Supprimer", destructive: true, success: "Brouillon supprimé" },
};

export function PurchaseDetailPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const navigate = useNavigate();
  const { can } = useAuth();
  const [action, setAction] = useState<Action | null>(null);
  const [receiving, setReceiving] = useState(false);
  const q = useQuery({ queryKey: ["purchase-orders", "detail", orderId], queryFn: () => purchasingApi.get(orderId) });
  // L'API ne filtre pas les réceptions par commande : on charge la plus grande page possible et on filtre ici.
  const receipts = useQuery({ queryKey: ["receipts", { for: orderId }], queryFn: () => purchasingApi.receipts({ page_size: 100 }) });
  const run = useApiMutation((a: Action) => ({ place: purchasingApi.place, cancel: purchasingApi.cancel, delete: purchasingApi.remove })[a](orderId) as Promise<unknown>, {
    success: () => TEXT[action ?? "place"].success, invalidate: INVALIDATE,
    onSuccess: () => { const a = action; setAction(null); if (a === "delete") navigate("/purchase-orders"); },
  });
  return (
    <QueryState query={q}>
      {(o) => {
        const write = can("purchasing.write");
        const mine = (receipts.data?.results ?? []).filter((r) => r.purchase_order === o.id);
        const canReceive = can("purchasing.receive") && (o.status === "ORDERED" || o.status === "PARTIALLY_RECEIVED");
        const nothingReceived = o.lines.every((l) => (toScaled(l.quantity_received) ?? 0n) === 0n);
        return (
          <>
            <PageHeader title={o.number} description={`${o.supplier_name} · ${o.warehouse_name}`}
              actions={<>
                <PurchaseStatusBadge status={o.status} />
                {write && o.status === "DRAFT" && <><Link to={`/purchase-orders/${o.id}/edit`}><Button variant="outline">Modifier</Button></Link><Button onClick={() => setAction("place")}>Passer la commande</Button><Button variant="ghost" className="text-destructive" onClick={() => setAction("delete")}>Supprimer</Button></>}
                {canReceive && <Button onClick={() => setReceiving(true)}>Réceptionner</Button>}
                {write && (o.status === "DRAFT" || (o.status === "ORDERED" && nothingReceived)) && <Button variant="outline" onClick={() => setAction("cancel")}>Annuler</Button>}
              </>} />
            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
              <Card>
                <CardHeader><CardTitle>Lignes de la commande</CardTitle></CardHeader>
                {o.lines.length === 0 ? <EmptyState title="Aucune ligne" description="Ajoutez des lignes en modifiant le brouillon." /> : (
                  <TableWrap><Table>
                    <thead><tr><Th>Produit</Th><Th className="text-right">Commandé</Th><Th className="text-right">Reçu</Th><Th className="text-right">Restant</Th><Th className="text-right">Coût unitaire</Th><Th className="text-right">Total</Th></tr></thead>
                    <tbody>{o.lines.map((l) => <tr key={l.id}><Td><span className="font-medium">{l.product_name}</span> <span className="font-mono text-xs text-muted-foreground">{l.product_sku}</span></Td><Td className="text-right tabular-nums">{formatQuantity(l.quantity_ordered)}</Td><Td className="text-right tabular-nums">{formatQuantity(l.quantity_received)}</Td><Td className="text-right tabular-nums">{formatQuantity(l.quantity_remaining)}</Td><Td className="text-right tabular-nums">{formatAmount(l.unit_cost)}</Td><Td className="text-right tabular-nums">{formatAmount(lineTotal(l.quantity_ordered, l.unit_cost))}</Td></tr>)}</tbody>
                    <tfoot><tr><Td colSpan={5} className="text-right font-medium">Total commandé</Td><Td className="text-right text-base font-semibold tabular-nums">{formatAmount(orderTotal(o))}</Td></tr></tfoot>
                  </Table></TableWrap>)}
              </Card>
              <Card><CardHeader><CardTitle>Informations</CardTitle></CardHeader><CardContent>
                <dl className="space-y-3 text-sm"><div><dt className="text-muted-foreground">Créée le</dt><dd>{formatDateTime(o.created_at)}</dd></div><div><dt className="text-muted-foreground">Passée le</dt><dd>{formatDateTime(o.ordered_at)}</dd></div></dl>
              </CardContent></Card>
            </div>
            <Card className="mt-6">
              <CardHeader><CardTitle>Réceptions</CardTitle></CardHeader>
              {receipts.isPending ? <TableSkeleton rows={2} /> : receipts.isError ? <ErrorState error={receipts.error} onRetry={() => receipts.refetch()} />
                : mine.length === 0 ? <EmptyState title="Aucune réception" />
                : <ul className="divide-y">{mine.map((r) => (<li key={r.id} className="px-5 py-3 text-sm"><p className="font-medium">Réception #{r.id} · {formatDateTime(r.created_at)}</p><p className="text-muted-foreground">{r.lines.map((l) => `${l.product_name} × ${formatQuantity(l.quantity)}`).join(", ")}</p></li>))}</ul>}
            </Card>
            {action && <ConfirmDialog open title={TEXT[action].title} message={TEXT[action].message} confirmLabel={TEXT[action].label} destructive={TEXT[action].destructive} loading={run.isPending} onClose={() => setAction(null)} onConfirm={() => run.mutate(action)} />}
            {receiving && <ReceiveModal order={o} onClose={() => setReceiving(false)} />}
          </>
        );
      }}
    </QueryState>
  );
}

export function ReceiptsPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["receipts", { page }], queryFn: () => purchasingApi.receipts({ page }) });
  return (
    <>
      <PageHeader title="Réceptions" description="Historique des réceptions de marchandises (lecture seule)." />
      <Card>
        <QueryState query={q} isEmpty={(d) => d.results.length === 0} empty={<EmptyState title="Aucune réception" />}>
          {(d) => (<>
            <TableWrap><Table>
              <thead><tr><Th>Réception</Th><Th>Commande</Th><Th>Date</Th><Th>Contenu</Th></tr></thead>
              <tbody>{d.results.map((r) => (<tr key={r.id}><Td>#{r.id}</Td><Td><Link to={`/purchase-orders/${r.purchase_order}`} className="font-mono text-xs text-primary hover:underline">{r.purchase_order_number}</Link></Td><Td className="text-muted-foreground">{formatDateTime(r.created_at)}</Td><Td>{r.lines.map((l) => `${l.product_name} × ${formatQuantity(l.quantity)}`).join(", ")}</Td></tr>))}</tbody>
            </Table></TableWrap>
            <Pagination page={page} count={d.count} onPage={setPage} />
          </>)}
        </QueryState>
      </Card>
    </>
  );
}
