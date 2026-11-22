import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { warehousesApi } from "@/api/inventory";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { ActiveBadge, EmptyState, PageHeader, Pagination, QueryState } from "@/components/common/common";
import { useApiMutation } from "@/hooks/useApiMutation";
import { applyServerErrors } from "@/lib/validation";
import type { Warehouse } from "@/types/api";
import { useAuth } from "@/features/auth/AuthContext";

const schema = z.object({ code: z.string().trim().min(1, "Le code est requis").max(20, "20 caractères max"), name: z.string().trim().min(1, "Le nom est requis").max(100), is_active: z.boolean() });
type Values = z.infer<typeof schema>;

function WarehouseForm({ warehouse, onClose }: { warehouse: Warehouse | null; onClose: () => void }) {
  const [banner, setBanner] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { code: warehouse?.code ?? "", name: warehouse?.name ?? "", is_active: warehouse?.is_active ?? true } });
  const m = useApiMutation((v: Values) => (warehouse ? warehousesApi.update(warehouse.id, v) : warehousesApi.create(v)), {
    success: warehouse ? "Entrepôt modifié" : "Entrepôt créé", invalidate: [["warehouses"], ["ref", "warehouses"], ["dashboard"]], silentError: true, onSuccess: onClose,
  });
  return (
    <Modal open onClose={onClose} title={warehouse ? "Modifier l'entrepôt" : "Nouvel entrepôt"}>
      <form noValidate className="space-y-4" onSubmit={handleSubmit((v) => m.mutate(v, { onError: (e) => setBanner(applyServerErrors(e, setError, ["code", "name", "is_active"])) }))}>
        {banner && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{banner}</p>}
        <Field label="Code" hint="Unique." error={errors.code?.message}>{(p) => <Input {...p} {...register("code")} />}</Field>
        <Field label="Nom" error={errors.name?.message}>{(p) => <Input {...p} {...register("name")} />}</Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" {...register("is_active")} />Actif</label>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" loading={m.isPending}>Enregistrer</Button></div>
      </form>
    </Modal>
  );
}

export function WarehousesPage() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<Warehouse | "new" | null>(null);
  const [detail, setDetail] = useState<Warehouse | null>(null);
  const q = useQuery({ queryKey: ["warehouses", { page }], queryFn: () => warehousesApi.list({ page }) });
  const write = can("warehouses.write");
  return (
    <>
      <PageHeader title="Entrepôts" actions={write && <Button onClick={() => setForm("new")}><Plus className="h-4 w-4" />Nouvel entrepôt</Button>} />
      <Card>
        <QueryState query={q} isEmpty={(d) => d.results.length === 0} empty={<EmptyState title="Aucun entrepôt" />}>
          {(d) => (<>
            <TableWrap><Table>
              <thead><tr><Th>Code</Th><Th>Nom</Th><Th>Statut</Th><Th className="text-right">Actions</Th></tr></thead>
              <tbody>{d.results.map((w) => (
                <tr key={w.id} className="hover:bg-muted/40"><Td className="font-mono text-xs">{w.code}</Td><Td className="font-medium">{w.name}</Td><Td><ActiveBadge active={w.is_active} /></Td>
                  <Td className="text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setDetail(w)}>Détails</Button>{write && <Button size="sm" variant="outline" onClick={() => setForm(w)}>Modifier</Button>}</div></Td></tr>))}</tbody>
            </Table></TableWrap>
            <Pagination page={page} count={d.count} onPage={setPage} />
          </>)}
        </QueryState>
      </Card>
      {form && <WarehouseForm warehouse={form === "new" ? null : form} onClose={() => setForm(null)} />}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""}>
        {detail && <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Code</dt><dd className="font-mono">{detail.code}</dd></div><div><dt className="text-muted-foreground">Statut</dt><dd><ActiveBadge active={detail.is_active} /></dd></div></dl>}
      </Modal>
    </>
  );
}
