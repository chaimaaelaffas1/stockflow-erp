import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { z } from "zod";

import { SlidersHorizontal } from "lucide-react";

import { stockApi } from "@/api/inventory";

import { Badge, Card } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Field, Input, Select, Textarea } from "@/components/ui/form";

import { Modal } from "@/components/ui/modal";

import { Table, TableWrap, Td, Th } from "@/components/ui/table";

import {
  EmptyState,
  PageHeader,
  Pagination,
  QueryState,
} from "@/components/common/common";

import { useApiMutation } from "@/hooks/useApiMutation";

import { useProductsRef, useWarehousesRef } from "@/hooks/useReferenceData";

import { applyServerErrors, decimalField } from "@/lib/validation";

import { compareDecimals } from "@/lib/decimal";

import { formatDateTime, formatQuantity } from "@/lib/format";

import type { MovementType } from "@/types/api";

import { useAuth } from "@/features/auth/AuthContext";

// ============================================================
// CONSTANTS
// ============================================================

const MOVEMENT_LABELS: Record<MovementType, string> = {
  RECEIPT: "Réception",
  SHIPMENT: "Expédition",
  RESERVE: "Réservation",
  RELEASE: "Libération",
  ADJUSTMENT: "Ajustement",
};

// ============================================================
// REFERENCE DATA
// ============================================================

function useNames() {
  const products = useProductsRef();
  const warehouses = useWarehousesRef();

  return {
    products,
    warehouses,

    product: (id: number) => {
      const p = products.items.find((x) => x.id === id);

      return p ? `${p.sku} — ${p.name}` : `Produit #${id}`;
    },

    warehouse: (id: number) =>
      warehouses.items.find((w) => w.id === id)?.name ?? `Entrepôt #${id}`,
  };
}

// ============================================================
// ADJUSTMENT VALIDATION
// ============================================================

const adjSchema = z.object({
  product: z.string().min(1, "Choisissez un produit"),

  warehouse: z.string().min(1, "Choisissez un entrepôt"),

  quantity_delta: decimalField({
    dp: 3,
    min: "any",
    label: "Quantité",
  }).refine((s) => Number(s) !== 0, "L'ajustement ne peut pas être nul"),

  reason: z.string().trim().min(1, "Le motif est obligatoire"),
});

type AdjValues = z.infer<typeof adjSchema>;

// ============================================================
// ADJUSTMENT MODAL
// ============================================================

export function AdjustmentModal({ onClose }: { onClose: () => void }) {
  const n = useNames();

  const [banner, setBanner] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AdjValues>({
    resolver: zodResolver(adjSchema),

    defaultValues: {
      product: "",
      warehouse: "",
      quantity_delta: "",
      reason: "",
    },
  });

  // Jamais de modification directe d'un StockLevel :
  // on passe par l'opération métier dédiée.

  const m = useApiMutation(
    (v: AdjValues) =>
      stockApi.adjust({
        ...v,
        product: Number(v.product),
        warehouse: Number(v.warehouse),
      }),
    {
      success: "Ajustement enregistré",

      invalidate: [["stock-levels"], ["stock-movements"], ["dashboard"]],

      silentError: true,

      onSuccess: onClose,
    },
  );

  return (
    <Modal open onClose={onClose} title="Ajustement manuel du stock">
      <form
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit((v) =>
          m.mutate(v, {
            onError: (e) =>
              setBanner(
                applyServerErrors(e, setError, [
                  "product",
                  "warehouse",
                  "quantity_delta",
                  "reason",
                ]),
              ),
          }),
        )}
      >
        {banner && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {banner}
          </p>
        )}

        <Field label="Produit" error={errors.product?.message}>
          {(p) => (
            <Select {...p} {...register("product")}>
              <option value="">Choisir…</option>

              {n.products.items.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.sku} — {x.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Entrepôt" error={errors.warehouse?.message}>
          {(p) => (
            <Select {...p} {...register("warehouse")}>
              <option value="">Choisir…</option>

              {n.warehouses.items.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Variation de quantité"
          hint="Positive pour ajouter, négative pour retirer (ex. -5)."
          error={errors.quantity_delta?.message}
        >
          {(p) => (
            <Input inputMode="decimal" {...p} {...register("quantity_delta")} />
          )}
        </Field>

        <Field label="Motif" error={errors.reason?.message}>
          {(p) => <Textarea {...p} {...register("reason")} />}
        </Field>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>

          <Button type="submit" loading={m.isPending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// FILTER TYPES
// ============================================================

// FIX TS2322:
// Les filtres peuvent contenir des chaînes et des booléens.
// Les propriétés spécifiques à chaque page sont optionnelles.

type FilterValues = {
  product: string;
  warehouse: string;

  low?: boolean;
  threshold?: string;

  movement_type?: string;
  since?: string;
};

// ============================================================
// SHARED FILTERS
// ============================================================

function Filters({
  n,
  f,
  set,
}: {
  n: ReturnType<typeof useNames>;
  f: FilterValues;
  set: (k: string, v: string) => void;
}) {
  return (
    <>
      <Select
        aria-label="Produit"
        value={f.product}
        onChange={(e) => set("product", e.target.value)}
      >
        <option value="">Tous les produits</option>

        {n.products.items.map((p) => (
          <option key={p.id} value={p.id}>
            {p.sku} — {p.name}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Entrepôt"
        value={f.warehouse}
        onChange={(e) => set("warehouse", e.target.value)}
      >
        <option value="">Tous les entrepôts</option>

        {n.warehouses.items.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </Select>
    </>
  );
}

// ============================================================
// STOCK LEVELS PAGE
// ============================================================

export function StockLevelsPage() {
  const { can } = useAuth();

  const n = useNames();

  const [page, setPage] = useState(1);

  const [f, setF] = useState({
    product: "",
    warehouse: "",
    low: false,
    threshold: "5",
  });

  const [adjust, setAdjust] = useState(false);

  const set = (k: string, v: string) => {
    setF((s) => ({
      ...s,
      [k]: v,
    }));

    setPage(1);
  };

  const thr = f.threshold.replace(",", ".");

  const params = {
    page,
    product: f.product,
    warehouse: f.warehouse,

    ...(f.low
      ? {
          low_stock: "true" as const,
          threshold: thr,
        }
      : {}),
  };

  const q = useQuery({
    queryKey: ["stock-levels", params],
    queryFn: () => stockApi.levels(params),
  });

  return (
    <>
      <PageHeader
        title="Niveaux de stock"
        description="Disponible = en stock − réservé (calculé par le serveur)."
        actions={
          can("stock.adjust") && (
            <Button onClick={() => setAdjust(true)}>
              <SlidersHorizontal className="h-4 w-4" />
              Ajuster le stock
            </Button>
          )
        }
      />

      <Card>
        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Filters n={n} f={f} set={set} />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={f.low}
              onChange={(e) => {
                setF((s) => ({
                  ...s,
                  low: e.target.checked,
                }));

                setPage(1);
              }}
            />
            Stock faible (dispo ≤
          </label>

          {f.low && (
            <Input
              inputMode="decimal"
              aria-label="Seuil de stock faible"
              className="w-24"
              value={f.threshold}
              onChange={(e) => set("threshold", e.target.value)}
            />
          )}
        </div>

        <QueryState
          query={q}
          isEmpty={(d) => d.results.length === 0}
          empty={
            <EmptyState
              title="Aucun niveau de stock"
              description="Le stock apparaît après une réception ou un ajustement."
            />
          }
        >
          {(d) => (
            <>
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Produit</Th>
                      <Th>Entrepôt</Th>
                      <Th className="text-right">En stock</Th>
                      <Th className="text-right">Réservé</Th>
                      <Th className="text-right">Disponible</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {d.results.map((l) => (
                      <tr key={l.id} className="hover:bg-muted/40">
                        <Td className="font-medium">{n.product(l.product)}</Td>

                        <Td>{n.warehouse(l.warehouse)}</Td>

                        <Td className="text-right tabular-nums">
                          {formatQuantity(l.on_hand)}
                        </Td>

                        <Td className="text-right tabular-nums">
                          {formatQuantity(l.reserved)}
                        </Td>

                        <Td className="text-right tabular-nums font-medium">
                          {compareDecimals(l.available, "0") <= 0 ? (
                            <Badge tone="danger">
                              {formatQuantity(l.available)}
                            </Badge>
                          ) : (
                            formatQuantity(l.available)
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>

              <Pagination page={page} count={d.count} onPage={setPage} />
            </>
          )}
        </QueryState>
      </Card>

      {adjust && <AdjustmentModal onClose={() => setAdjust(false)} />}
    </>
  );
}

// ============================================================
// STOCK MOVEMENTS PAGE
// ============================================================

export function StockMovementsPage() {
  const { can } = useAuth();

  const n = useNames();

  const [page, setPage] = useState(1);

  const [f, setF] = useState({
    product: "",
    warehouse: "",
    movement_type: "",
    since: "",
  });

  const [adjust, setAdjust] = useState(false);

  const set = (k: string, v: string) => {
    setF((s) => ({
      ...s,
      [k]: v,
    }));

    setPage(1);
  };

  const params = {
    page,
    product: f.product,
    warehouse: f.warehouse,

    movement_type: f.movement_type as MovementType | "",

    created_at__gte: f.since ? new Date(f.since).toISOString() : "",
  };

  const q = useQuery({
    queryKey: ["stock-movements", params],
    queryFn: () => stockApi.movements(params),
  });

  return (
    <>
      <PageHeader
        title="Mouvements de stock"
        description="Historique immuable : aucune modification ni suppression possible."
        actions={
          can("stock.adjust") && (
            <Button onClick={() => setAdjust(true)}>
              <SlidersHorizontal className="h-4 w-4" />
              Ajuster le stock
            </Button>
          )
        }
      />

      <Card>
        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Filters n={n} f={f} set={set} />

          <Select
            aria-label="Type de mouvement"
            value={f.movement_type}
            onChange={(e) => set("movement_type", e.target.value)}
          >
            <option value="">Tous les types</option>

            {(Object.keys(MOVEMENT_LABELS) as MovementType[]).map((t) => (
              <option key={t} value={t}>
                {MOVEMENT_LABELS[t]}
              </option>
            ))}
          </Select>

          <Input
            type="date"
            aria-label="Depuis le"
            value={f.since}
            onChange={(e) => set("since", e.target.value)}
          />
        </div>

        <QueryState
          query={q}
          isEmpty={(d) => d.results.length === 0}
          empty={<EmptyState title="Aucun mouvement" />}
        >
          {(d) => (
            <>
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Type</Th>
                      <Th>Produit</Th>
                      <Th>Entrepôt</Th>
                      <Th className="text-right">Δ en stock</Th>
                      <Th className="text-right">Δ réservé</Th>
                      <Th>Référence / motif</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {d.results.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/40">
                        <Td className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(m.created_at)}
                        </Td>

                        <Td>
                          <Badge
                            tone={
                              m.movement_type === "ADJUSTMENT"
                                ? "warning"
                                : "info"
                            }
                          >
                            {MOVEMENT_LABELS[m.movement_type]}
                          </Badge>
                        </Td>

                        <Td>{n.product(m.product)}</Td>

                        <Td>{n.warehouse(m.warehouse)}</Td>

                        <Td className="text-right tabular-nums">
                          {formatQuantity(m.on_hand_delta)}
                        </Td>

                        <Td className="text-right tabular-nums">
                          {formatQuantity(m.reserved_delta)}
                        </Td>

                        <Td className="text-muted-foreground">
                          {[m.reference, m.reason]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>

              <Pagination page={page} count={d.count} onPage={setPage} />
            </>
          )}
        </QueryState>
      </Card>

      {adjust && <AdjustmentModal onClose={() => setAdjust(false)} />}
    </>
  );
}
