import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/api/dashboard";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { EmptyState, PageHeader, Pagination, QueryState } from "@/components/common/common";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDateTime } from "@/lib/format";

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [f, setF] = useState({ action: "", object_type: "", object_id: "", actor: "" });
  const d = useDebounce(f, 400);
  const params = { page, ...d };
  const q = useQuery({ queryKey: ["audit", params], queryFn: () => auditApi.list(params) });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((s) => ({ ...s, [k]: e.target.value })); setPage(1); };
  return (
    <>
      <PageHeader title="Journal d'audit" description="Événements enregistrés par le serveur (lecture seule, administrateurs uniquement)." />
      <Card>
        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input aria-label="Action" placeholder="Action (ex. sales_order.confirmed)" value={f.action} onChange={set("action")} />
          <Input aria-label="Type d'objet" placeholder="Type (ex. sales.SalesOrder)" value={f.object_type} onChange={set("object_type")} />
          <Input aria-label="ID de l'objet" inputMode="numeric" placeholder="ID de l'objet" value={f.object_id} onChange={set("object_id")} />
          <Input aria-label="ID de l'acteur" inputMode="numeric" placeholder="ID de l'acteur" value={f.actor} onChange={set("actor")} />
        </div>
        <QueryState query={q} isEmpty={(x) => x.results.length === 0} empty={<EmptyState title="Aucun événement" description="Modifiez les filtres." />}>
          {(x) => (<>
            <TableWrap><Table>
              <thead><tr><Th>Date</Th><Th>Acteur</Th><Th>Action</Th><Th>Objet</Th><Th>Détails</Th></tr></thead>
              <tbody>{x.results.map((l) => (
                <tr key={l.id} className="align-top hover:bg-muted/40">
                  <Td className="whitespace-nowrap text-muted-foreground">{formatDateTime(l.created_at)}</Td>
                  <Td>{l.actor_email ?? <span className="text-muted-foreground">— (supprimé)</span>}</Td>
                  <Td className="font-mono text-xs font-medium">{l.action}</Td>
                  <Td className="text-xs">{l.object_type} <span className="text-muted-foreground">#{l.object_id}</span></Td>
                  <Td><pre className="max-w-md whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">{JSON.stringify(l.payload)}</pre></Td>
                </tr>))}</tbody>
            </Table></TableWrap>
            <Pagination page={page} count={x.count} onPage={setPage} />
          </>)}
        </QueryState>
      </Card>
    </>
  );
}
