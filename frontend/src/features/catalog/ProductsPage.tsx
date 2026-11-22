import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search } from "lucide-react";
import { productsApi } from "@/api/catalog";
import { stockApi } from "@/api/inventory";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { ActiveBadge, ConfirmDialog, EmptyState, PageHeader, Pagination, QueryState } from "@/components/common/common";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useDebounce } from "@/hooks/useDebounce";
import { useCategoriesRef, useWarehousesRef } from "@/hooks/useReferenceData";
import { applyServerErrors, decimalField } from "@/lib/validation";
import { formatAmount, formatQuantity } from "@/lib/format";
import type { Product } from "@/types/api";
import { useAuth } from "@/features/auth/AuthContext";

const schema = z.object({
  sku: z.string().trim().min(1, "Le SKU est requis").max(40, "40 caractères max"),
  name: z.string().trim().min(1, "Le nom est requis").max(200),
  description: z.string(),
  category: z.string().min(1, "Choisissez une catégorie"),
  unit_price: decimalField({ dp: 2, label: "Prix" }),
  reorder_level: decimalField({ dp: 3, label: "Seuil" }),
  is_active: z.boolean(),
});
type Values = z.infer<typeof schema>;

function ProductForm({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const cats = useCategoriesRef();
  const [banner, setBanner] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: product?.sku ?? "", name: product?.name ?? "", description: product?.description ?? "",
      category: product ? String(product.category) : "", unit_price: product?.unit_price ?? "", reorder_level: product?.reorder_level ?? "0", is_active: product?.is_active ?? true,
    },
  });
  const m = useApiMutation(
    (v: Values) => {
      const body = { ...v, category: Number(v.category) };
      return product ? productsApi.update(product.id, body) : productsApi.create(body);
    },
    { success: product ? "Produit modifié" : "Produit créé", invalidate: [["products"], ["ref", "products"], ["dashboard"]], silentError: true, onSuccess: onClose },
  );
  return (
    <Modal open onClose={onClose} title={product ? "Modifier le produit" : "Nouveau produit"} wide>
      <form noValidate className="space-y-4" onSubmit={handleSubmit((v) => m.mutate(v, { onError: (e) => setBanner(applyServerErrors(e, setError, ["sku", "name", "description", "category", "unit_price", "reorder_level", "is_active"])) }))}>
        {banner && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{banner}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU" hint="Converti en majuscules par le serveur." error={errors.sku?.message}>{(p) => <Input {...p} {...register("sku")} />}</Field>
          <Field label="Nom" error={errors.name?.message}>{(p) => <Input {...p} {...register("name")} />}</Field>
        </div>
        <Field label="Description" error={errors.description?.message}>{(p) => <Textarea {...p} {...register("description")} />}</Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Catégorie" error={errors.category?.message}>
            {(p) => <Select {...p} {...register("category")}><option value="">Choisir…</option>{cats.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}
          </Field>
          <Field label="Prix unitaire" error={errors.unit_price?.message}>{(p) => <Input inputMode="decimal" {...p} {...register("unit_price")} />}</Field>
          <Field label="Seuil de réappro." error={errors.reorder_level?.message}>{(p) => <Input inputMode="decimal" {...p} {...register("reorder_level")} />}</Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" {...register("is_active")} />Produit actif</label>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" loading={m.isPending}>Enregistrer</Button></div>
      </form>
    </Modal>
  );
}

function ProductDetail({ product, onClose }: { product: Product; onClose: () => void }) {
  const wh = useWarehousesRef();
  const levels = useQuery({ queryKey: ["stock-levels", { product: String(product.id), detail: true }], queryFn: () => stockApi.levels({ product: String(product.id) }) });
  const whName = (id: number) => wh.items.find((w) => w.id === id)?.name ?? `#${id}`;
  return (
    <Modal open onClose={onClose} title={`${product.sku} — ${product.name}`} wide>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Catégorie</dt><dd>{product.category_name}</dd></div>
        <div><dt className="text-muted-foreground">Prix unitaire</dt><dd className="tabular-nums">{formatAmount(product.unit_price)}</dd></div>
        <div><dt className="text-muted-foreground">Seuil de réapprovisionnement</dt><dd className="tabular-nums">{formatQuantity(product.reorder_level)}</dd></div>
        <div className="sm:col-span-3"><dt className="text-muted-foreground">Description</dt><dd>{product.description || "—"}</dd></div>
      </dl>
      <h3 className="mb-2 mt-6 text-sm font-semibold">Stock par entrepôt</h3>
      <div className="rounded-md border">
        <QueryState query={levels} isEmpty={(d) => d.results.length === 0} empty={<EmptyState title="Aucun stock enregistré" />}>
          {(d) => (<TableWrap><Table>
            <thead><tr><Th>Entrepôt</Th><Th className="text-right">En stock</Th><Th className="text-right">Réservé</Th><Th className="text-right">Disponible</Th></tr></thead>
            <tbody>{d.results.map((l) => <tr key={l.id}><Td>{whName(l.warehouse)}</Td><Td className="text-right tabular-nums">{formatQuantity(l.on_hand)}</Td><Td className="text-right tabular-nums">{formatQuantity(l.reserved)}</Td><Td className="text-right font-medium tabular-nums">{formatQuantity(l.available)}</Td></tr>)}</tbody>
          </Table></TableWrap>)}
        </QueryState>
      </div>
    </Modal>
  );
}

export function ProductsPage() {
  const { can } = useAuth();
  const cats = useCategoriesRef();
  const [page, setPage] = useState(1);
  const [f, setF] = useState({ search: "", category: "", is_active: "", price_min: "", price_max: "" });
  const dSearch = useDebounce(f.search);
  const dMin = useDebounce(f.price_min, 500);
  const dMax = useDebounce(f.price_max, 500);
  const [form, setForm] = useState<Product | "new" | null>(null);
  const [detail, setDetail] = useState<Product | null>(null);
  const [toDeactivate, setToDeactivate] = useState<Product | null>(null);
  const params = { page, search: dSearch, category: f.category, is_active: f.is_active, price_min: dMin.replace(",", "."), price_max: dMax.replace(",", ".") };
  const q = useQuery({ queryKey: ["products", params], queryFn: () => productsApi.list(params) });
  const deactivate = useApiMutation((id: number) => productsApi.deactivate(id), { success: "Produit désactivé", invalidate: [["products"], ["ref", "products"], ["dashboard"]], onSuccess: () => setToDeactivate(null) });
  const write = can("catalog.write");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((s) => ({ ...s, [k]: e.target.value })); setPage(1); };

  return (
    <>
      <PageHeader title="Produits" description="Les produits ne sont pas supprimables : désactivez-les pour conserver l'historique."
        actions={write && <Button onClick={() => setForm("new")}><Plus className="h-4 w-4" />Nouveau produit</Button>} />
      <Card>
        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden /><Input className="pl-9" aria-label="Rechercher" placeholder="Nom ou SKU…" value={f.search} onChange={set("search")} /></div>
          <Select aria-label="Catégorie" value={f.category} onChange={set("category")}><option value="">Toutes catégories</option>{cats.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select aria-label="Statut" value={f.is_active} onChange={set("is_active")}><option value="">Tous statuts</option><option value="true">Actifs</option><option value="false">Inactifs</option></Select>
          <div className="flex gap-2"><Input inputMode="decimal" aria-label="Prix minimum" placeholder="Prix min" value={f.price_min} onChange={set("price_min")} /><Input inputMode="decimal" aria-label="Prix maximum" placeholder="Prix max" value={f.price_max} onChange={set("price_max")} /></div>
        </div>
        <QueryState query={q} isEmpty={(d) => d.results.length === 0} empty={<EmptyState title="Aucun produit trouvé" description="Modifiez la recherche ou les filtres." />}>
          {(d) => (<>
            <TableWrap><Table>
              <thead><tr><Th>SKU</Th><Th>Nom</Th><Th>Catégorie</Th><Th className="text-right">Prix</Th><Th>Statut</Th><Th className="text-right">Actions</Th></tr></thead>
              <tbody>{d.results.map((p) => (
                <tr key={p.id} className="hover:bg-muted/40">
                  <Td className="font-mono text-xs">{p.sku}</Td><Td className="font-medium">{p.name}</Td><Td>{p.category_name}</Td>
                  <Td className="text-right tabular-nums">{formatAmount(p.unit_price)}</Td><Td><ActiveBadge active={p.is_active} /></Td>
                  <Td className="text-right"><div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setDetail(p)}>Détails</Button>
                    {write && <Button size="sm" variant="outline" onClick={() => setForm(p)}>Modifier</Button>}
                    {write && p.is_active && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setToDeactivate(p)}>Désactiver</Button>}
                  </div></Td>
                </tr>))}</tbody>
            </Table></TableWrap>
            <Pagination page={page} count={d.count} onPage={setPage} />
          </>)}
        </QueryState>
      </Card>
      {form && <ProductForm product={form === "new" ? null : form} onClose={() => setForm(null)} />}
      {detail && <ProductDetail product={detail} onClose={() => setDetail(null)} />}
      <ConfirmDialog open={!!toDeactivate} destructive loading={deactivate.isPending} title="Désactiver le produit" confirmLabel="Désactiver"
        message={<><strong>{toDeactivate?.name}</strong> ne pourra plus être commandé. L'historique est conservé.</>}
        onClose={() => setToDeactivate(null)} onConfirm={() => toDeactivate && deactivate.mutate(toDeactivate.id)} />
    </>
  );
}
