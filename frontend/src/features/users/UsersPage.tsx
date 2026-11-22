import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { usersApi, type UserInput } from "@/api/users";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { ActiveBadge, PageHeader, Pagination, QueryState } from "@/components/common/common";
import { Badge } from "@/components/ui/card";
import { useApiMutation } from "@/hooks/useApiMutation";
import { applyServerErrors } from "@/lib/validation";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import type { User } from "@/types/api";
import { useAuth } from "@/features/auth/AuthContext";

const ROLES = Object.keys(ROLE_LABELS) as Role[];

const baseSchema = z.object({
  email: z.string().min(1, "L'e-mail est requis").email("E-mail invalide"),
  first_name: z.string().max(150).optional(),
  last_name: z.string().max(150).optional(),
  role: z.enum(["ADMIN", "STOCK_MANAGER", "SALES", "PURCHASER", "VIEWER"]),
  is_active: z.boolean(),
  password: z.string().optional(),
});
type Values = z.infer<typeof baseSchema>;

function UserFormModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const editing = !!user;
  const { user: me } = useAuth();
  const [banner, setBanner] = useState<string | null>(null);
  // Création : mot de passe obligatoire. Édition : facultatif (PATCH).
  const schema = baseSchema.refine((v) => editing || (v.password && v.password.length > 0), { path: ["password"], message: "Le mot de passe est requis" });
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: user?.email ?? "", first_name: user?.first_name ?? "", last_name: user?.last_name ?? "", role: user?.role ?? "VIEWER", is_active: user?.is_active ?? true, password: "" },
  });
  const m = useApiMutation(
    (v: Values) => {
      const body: UserInput = { ...v, password: v.password || undefined };
      return editing ? usersApi.update(user.id, body) : usersApi.create(body);
    },
    { success: editing ? "Utilisateur mis à jour" : "Utilisateur créé", invalidate: [["users"]], silentError: true, onSuccess: onClose },
  );
  const onSubmit = (v: Values) =>
    m.mutate(v, { onError: (e) => setBanner(applyServerErrors(e, setError, ["email", "first_name", "last_name", "role", "is_active", "password"])) });

  return (
    <Modal open onClose={onClose} title={editing ? "Modifier l'utilisateur" : "Nouvel utilisateur"}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {banner && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{banner}</p>}
        {user && <p className="text-xs text-muted-foreground">Inscrit le {formatDate(user.date_joined)} · identifiant {user.username}</p>}
        <Field label="E-mail" error={errors.email?.message}>{(p) => <Input type="email" {...p} {...register("email")} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" error={errors.first_name?.message}>{(p) => <Input {...p} {...register("first_name")} />}</Field>
          <Field label="Nom" error={errors.last_name?.message}>{(p) => <Input {...p} {...register("last_name")} />}</Field>
        </div>
        <Field label="Rôle" error={errors.role?.message}>
          {(p) => <Select {...p} {...register("role")}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</Select>}
        </Field>
        <Field label={editing ? "Nouveau mot de passe" : "Mot de passe"} hint={editing ? "Laisser vide pour conserver l'actuel." : undefined} error={errors.password?.message}>
          {(p) => <Input type="password" autoComplete="new-password" {...p} {...register("password")} />}
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("is_active")} className="h-4 w-4 rounded border" />
          Compte actif
          {user?.id === me?.id && <span className="text-xs text-muted-foreground">(vous ne pouvez pas retirer vos propres droits si vous êtes le dernier administrateur)</span>}
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={m.isPending}>{editing ? "Enregistrer" : "Créer"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function UsersPage() {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const q = useQuery({ queryKey: ["users", { page }], queryFn: () => usersApi.list({ page }) });
  const toggle = useApiMutation((u: User) => usersApi.update(u.id, { is_active: !u.is_active }), {
    success: (u) => (u.is_active ? "Utilisateur activé" : "Utilisateur désactivé"),
    invalidate: [["users"]],
  });

  return (
    <>
      <PageHeader title="Utilisateurs" description="Comptes et rôles. La suppression n'existe pas : désactivez un compte à la place."
        actions={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Nouvel utilisateur</Button>} />
      <Card>
        <QueryState query={q} isEmpty={(d) => d.results.length === 0}>
          {(d) => (
            <>
              <TableWrap><Table>
                <thead><tr><Th>Utilisateur</Th><Th>Rôle</Th><Th>Statut</Th><Th>Inscrit le</Th><Th className="text-right">Actions</Th></tr></thead>
                <tbody>{d.results.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/40">
                    <Td><p className="font-medium">{[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}</p><p className="text-xs text-muted-foreground">{u.email}</p></Td>
                    <Td><Badge tone="info">{ROLE_LABELS[u.role]}</Badge></Td>
                    <Td><ActiveBadge active={u.is_active} /></Td>
                    <Td className="text-muted-foreground">{formatDate(u.date_joined)}</Td>
                    <Td className="text-right"><div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(u)}>Modifier</Button>
                      <Button size="sm" variant="ghost" loading={toggle.isPending && toggle.variables?.id === u.id} onClick={() => toggle.mutate(u)}>{u.is_active ? "Désactiver" : "Activer"}</Button>
                    </div></Td>
                  </tr>))}</tbody>
              </Table></TableWrap>
              <Pagination page={page} count={d.count} onPage={setPage} />
            </>
          )}
        </QueryState>
      </Card>
      {editing && <UserFormModal user={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
