import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search } from "lucide-react";
import { categoriesApi } from "@/api/catalog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { ConfirmDialog, EmptyState, PageHeader, Pagination, QueryState } from "@/components/common/common";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useDebounce } from "@/hooks/useDebounce";
import { applyServerErrors } from "@/lib/validation";
import { formatDate } from "@/lib/format";
import type { Category } from "@/types/api";
import { useAuth } from "@/features/auth/AuthContext";

const schema = z.object({ name: z.string().trim().min(1, "Le nom est requis").max(100, "100 caractères max") });
type Values = z.infer<typeof schema>;

function CategoryForm({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const [banner, setBanner] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: category?.name ?? "" } });
  const m = useApiMutation((v: Values) => (category ? categoriesApi.update(category.id, v.name) : categoriesApi.create(v.name)), {
    success: category ? "Catégorie modifiée" : "Catégorie créée", invalidate: [["categories"], ["ref", "categories"], ["dashboard"]], silentError: true, onSuccess: onClose,
  });
  return (
    <Modal open onClose={onClose} title={category ? "Modifier la catégorie" : "Nouvelle catégorie"}>
      <form noValidate className="space-y-4" onSubmit={handleSubmit((v) => m.mutate(v, { onError: (e) => setBanner(applyServerErrors(e, setError, ["name"])) }))}>
        {banner && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{banner}</p>}
        <Field label="Nom" error={errors.name?.message}>{(p) => <Input autoFocus {...p} {...register("name")} />}</Field>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" loading={m.isPending}>Enregistrer</Button></div>
      </form>
    </Modal>
  );
}

export function CategoriesPage() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const dSearch = useDebounce(search);
  const [form, setForm] = useState<Category | "new" | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const q = useQuery({ queryKey: ["categories", { page, search: dSearch }], queryFn: () => categoriesApi.list({ page, search: dSearch }) });
  const del = useApiMutation((id: number) => categoriesApi.remove(id), { success: "Catégorie supprimée", invalidate: [["categories"], ["ref", "categories"], ["dashboard"]], onSuccess: () => setToDelete(null) });
  const write = can("catalog.write");
  return (
    <>
      <PageHeader title="Catégories" actions={write && <Button onClick={() => setForm("new")}><Plus className="h-4 w-4" />Nouvelle catégorie</Button>} />
      <Card>
        <div className="border-b p-4"><div className="relative max-w-sm"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden /><Input className="pl-9" aria-label="Rechercher" placeholder="Rechercher…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div></div>
        <QueryState query={q} isEmpty={(d) => d.results.length === 0} empty={<EmptyState title="Aucune catégorie" />}>
          {(d) => (<>
            <TableWrap><Table>
              <thead><tr><Th>Nom</Th><Th>Créée le</Th><Th className="text-right">Actions</Th></tr></thead>
              <tbody>{d.results.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40"><Td className="font-medium">{c.name}</Td><Td className="text-muted-foreground">{formatDate(c.created_at)}</Td>
                  <Td className="text-right"><div className="flex justify-end gap-2">
                    {write && <Button size="sm" variant="outline" onClick={() => setForm(c)}>Modifier</Button>}
                    {can("categories.delete") && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setToDelete(c)}>Supprimer</Button>}
                  </div></Td></tr>))}</tbody>
            </Table></TableWrap>
            <Pagination page={page} count={d.count} onPage={setPage} />
          </>)}
        </QueryState>
      </Card>
      {form && <CategoryForm category={form === "new" ? null : form} onClose={() => setForm(null)} />}
      <ConfirmDialog open={!!toDelete} destructive loading={del.isPending} title="Supprimer la catégorie" confirmLabel="Supprimer"
        message={<>Supprimer <strong>{toDelete?.name}</strong> ? Impossible si des produits l'utilisent.</>}
        onClose={() => setToDelete(null)} onConfirm={() => toDelete && del.mutate(toDelete.id)} />
    </>
  );
}
