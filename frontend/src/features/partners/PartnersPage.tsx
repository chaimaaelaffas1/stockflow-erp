import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search } from "lucide-react";
import { partnersApi, type PartnerKind } from "@/api/partners";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { ActiveBadge, ConfirmDialog, EmptyState, PageHeader, Pagination, QueryState } from "@/components/common/common";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useDebounce } from "@/hooks/useDebounce";
import { applyServerErrors } from "@/lib/validation";
import { formatDateTime } from "@/lib/format";
import type { Partner } from "@/types/api";
import { useAuth } from "@/features/auth/AuthContext";

const schema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(200),
  email: z.string().trim().email("E-mail invalide").or(z.literal("")),
  phone: z.string().max(30, "30 caractères max"),
  address: z.string(),
  is_active: z.boolean(),
});
type Values = z.infer<typeof schema>;

const META = {
  customers: { singular: "client", plural: "Clients", write: "customers.write", del: "customers.delete", refKey: "customers" },
  suppliers: { singular: "fournisseur", plural: "Fournisseurs", write: "suppliers.write", del: "suppliers.delete", refKey: "suppliers" },
} as const;

function PartnerForm({ kind, partner, onClose }: { kind: PartnerKind; partner: Partner | null; onClose: () => void }) {
  const api = partnersApi(kind);
  const meta = META[kind];
  const [banner, setBanner] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: partner?.name ?? "", email: partner?.email ?? "", phone: partner?.phone ?? "", address: partner?.address ?? "", is_active: partner?.is_active ?? true },
  });
  const m = useApiMutation(
    (v: Values) => {
      // email/phone vides → null (champs facultatifs, l'unicité de l'e-mail ne s'applique qu'aux valeurs renseignées)
      const body = { ...v, email: v.email || null, phone: v.phone || null };
      return partner ? api.update(partner.id, body) : api.create(body);
    },
    { success: partner ? "Modifications enregistrées" : `${meta.singular[0].toUpperCase()}${meta.singular.slice(1)} créé`, invalidate: [[kind], ["ref", kind], ["dashboard"]], silentError: true, onSuccess: onClose },
  );
  return (
    <Modal open onClose={onClose} title={partner ? `Modifier le ${meta.singular}` : `Nouveau ${meta.singular}`}>
      <form noValidate className="space-y-4" onSubmit={handleSubmit((v) => m.mutate(v, { onError: (e) => setBanner(applyServerErrors(e, setError, ["name", "email", "phone", "address", "is_active"])) }))}>
        {banner && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{banner}</p>}
        <Field label="Nom" error={errors.name?.message}>{(p) => <Input {...p} {...register("name")} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail" error={errors.email?.message}>{(p) => <Input type="email" {...p} {...register("email")} />}</Field>
          <Field label="Téléphone" error={errors.phone?.message}>{(p) => <Input {...p} {...register("phone")} />}</Field>
        </div>
        <Field label="Adresse" error={errors.address?.message}>{(p) => <Textarea {...p} {...register("address")} />}</Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" {...register("is_active")} />Actif</label>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" loading={m.isPending}>Enregistrer</Button></div>
      </form>
    </Modal>
  );
}

export function PartnersPage({ kind }: { kind: PartnerKind }) {
  const meta = META[kind];
  const api = partnersApi(kind);
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const dSearch = useDebounce(search);
  const [form, setForm] = useState<Partner | "new" | null>(null);
  const [detail, setDetail] = useState<Partner | null>(null);
  const [toDelete, setToDelete] = useState<Partner | null>(null);
  const params = { page, search: dSearch, is_active: active };
  const q = useQuery({ queryKey: [kind, params], queryFn: () => api.list(params) });
  const del = useApiMutation((id: number) => api.remove(id), { success: "Supprimé", invalidate: [[kind], ["ref", kind], ["dashboard"]], onSuccess: () => setToDelete(null) });
  const canWrite = can(meta.write);

  return (
    <>
      <PageHeader title={meta.plural} actions={canWrite && <Button onClick={() => setForm("new")}><Plus className="h-4 w-4" />Nouveau {meta.singular}</Button>} />
      <Card>
        <div className="flex flex-wrap gap-3 border-b p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input className="pl-9" placeholder="Nom, e-mail ou téléphone…" aria-label="Rechercher" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select className="w-40" aria-label="Statut" value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }}>
            <option value="">Tous les statuts</option><option value="true">Actifs</option><option value="false">Inactifs</option>
          </Select>
        </div>
        <QueryState query={q} isEmpty={(d) => d.results.length === 0} empty={<EmptyState title={`Aucun ${meta.singular} trouvé`} description="Modifiez la recherche ou les filtres." />}>
          {(d) => (
            <>
              <TableWrap><Table>
                <thead><tr><Th>Nom</Th><Th>E-mail</Th><Th>Téléphone</Th><Th>Statut</Th><Th className="text-right">Actions</Th></tr></thead>
                <tbody>{d.results.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/40">
                    <Td className="font-medium">{p.name}</Td><Td>{p.email ?? "—"}</Td><Td>{p.phone ?? "—"}</Td><Td><ActiveBadge active={p.is_active} /></Td>
                    <Td className="text-right"><div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setDetail(p)}>Détails</Button>
                      {canWrite && <Button size="sm" variant="outline" onClick={() => setForm(p)}>Modifier</Button>}
                      {can(meta.del) && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setToDelete(p)}>Supprimer</Button>}
                    </div></Td>
                  </tr>))}</tbody>
              </Table></TableWrap>
              <Pagination page={page} count={d.count} onPage={setPage} />
            </>
          )}
        </QueryState>
      </Card>
      {form && <PartnerForm kind={kind} partner={form === "new" ? null : form} onClose={() => setForm(null)} />}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""}>
        {detail && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">E-mail</dt><dd>{detail.email ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Téléphone</dt><dd>{detail.phone ?? "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">Adresse</dt><dd className="whitespace-pre-line">{detail.address || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Statut</dt><dd><ActiveBadge active={detail.is_active} /></dd></div>
            <div><dt className="text-muted-foreground">Créé le</dt><dd>{formatDateTime(detail.created_at)}</dd></div>
          </dl>
        )}
      </Modal>
      <ConfirmDialog open={!!toDelete} destructive loading={del.isPending} title={`Supprimer le ${meta.singular}`} confirmLabel="Supprimer"
        message={<>Supprimer définitivement <strong>{toDelete?.name}</strong> ? Impossible s'il est utilisé par des commandes.</>}
        onClose={() => setToDelete(null)} onConfirm={() => toDelete && del.mutate(toDelete.id)} />
    </>
  );
}
