import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowUpRight, Boxes, ClipboardList, Package, PackageX, ShoppingCart, Tags, Truck, Users, Wallet, Warehouse } from "lucide-react";
import type { ReactNode } from "react";
import { auditApi, dashboardApi } from "@/api/dashboard";
import { useAuth } from "@/features/auth/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui/card";
import { EmptyState, ErrorState, PageHeader, PURCHASE_LABELS, SALES_LABELS } from "@/components/common/common";
import { formatAmount, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PurchaseStatus, SalesStatus } from "@/types/api";

const SALES_ORDER: SalesStatus[] = ["DRAFT", "CONFIRMED", "SHIPPED", "CANCELLED"];
const PURCHASE_ORDER: PurchaseStatus[] = ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"];

// Une couleur par sens : gris = brouillon, bleu = en cours, ambre = partiel, vert = terminé, rouge = annulé.
const SALES_COLORS = ["#94a3b8", "#2563eb", "#16a34a", "#dc2626"];
const PURCHASE_COLORS = ["#94a3b8", "#2563eb", "#d97706", "#16a34a", "#dc2626"];

const TONES = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  violet: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  red: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
} as const;

function Stat({ icon, label, value, to, tone = "blue" }: { icon: ReactNode; label: string; value: ReactNode; to?: string; tone?: keyof typeof TONES }) {
  const body = (
    <Card className={cn("group p-5 transition-all", to && "hover:-translate-y-0.5 hover:shadow-pop")}>
      <div className="flex items-start justify-between">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", TONES[tone])}>{icon}</span>
        {to && <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />}
      </div>
      <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

const TOOLTIP_STYLE = { borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", boxShadow: "0 10px 30px -8px rgb(15 23 42 / 0.25)" };

function StatusChart({ data, colors }: { data: { name: string; value: number }[]; colors: string[] }) {
  if (data.every((d) => d.value === 0)) return <EmptyState title="Aucune commande" description="Les statistiques apparaîtront dès la première commande." />;
  return (
    <div className="h-60 w-full" role="img" aria-label="Graphique du nombre de commandes par statut">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval={0} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" name="Commandes" radius={[6, 6, 0, 0]} maxBarSize={48}>{data.map((_, i) => <Cell key={i} fill={colors[i]} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RecentActivity() {
  // Seul endpoint d'activité existant : le journal d'audit (ADMIN uniquement).
  const q = useQuery({ queryKey: ["audit", "recent"], queryFn: () => auditApi.list({ page: 1 }) });
  return (
    <Card>
      <CardHeader><CardTitle>Activité récente</CardTitle><Link to="/audit-logs" className="text-xs font-medium text-primary hover:underline">Tout voir</Link></CardHeader>
      {q.isPending ? <div className="space-y-2 p-4"><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
        : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
        : q.data.results.length === 0 ? <EmptyState title="Aucune activité" />
        : <ul className="divide-y">{q.data.results.slice(0, 6).map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span><span className="font-medium">{l.action}</span> <span className="text-muted-foreground">· {l.object_type} #{l.object_id}</span></span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(l.created_at)}</span>
            </li>))}</ul>}
    </Card>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-primary/5">
      <span className="text-primary">{icon}</span>{label}
    </Link>
  );
}

export function DashboardPage() {
  const { can, user } = useAuth();
  const q = useQuery({ queryKey: ["dashboard", "summary"], queryFn: dashboardApi.summary });
  const today = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date());

  return (
    <>
      <PageHeader title="Tableau de bord" description={`${user?.first_name ? `Bonjour ${user.first_name}, v` : "V"}oici l'état de votre activité — ${today}.`} />
      {q.isPending && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>}
      {q.isError && <Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>}
      {q.data && (() => {
        const s = q.data;
        const sales = SALES_ORDER.map((k) => ({ name: SALES_LABELS[k], value: s.sales_orders_by_status[k] ?? 0 }));
        const purchases = PURCHASE_ORDER.map((k) => ({ name: PURCHASE_LABELS[k].replace("Partiellement reçue", "Part. reçue"), value: s.purchase_orders_by_status[k] ?? 0 }));
        const inventory = [
          { name: "Produits actifs", value: s.active_products_count },
          { name: "Stock faible", value: s.products_low_stock },
          { name: "Rupture", value: s.products_out_of_stock },
        ];
        return (
          <div className="space-y-6">
            <Card className="relative overflow-hidden border-0 bg-sidebar p-6 text-white">
              <div className="bg-grid absolute inset-0" aria-hidden />
              <div className="absolute -right-16 -top-20 h-60 w-60 rounded-full bg-blue-600/30 blur-3xl" aria-hidden />
              <div className="relative flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-blue-300"><Wallet className="h-6 w-6" aria-hidden /></span>
                <div>
                  <p className="text-sm text-slate-300">Valeur du stock (au prix de liste)</p>
                  <p className="text-4xl font-semibold tabular-nums tracking-tight">{formatAmount(s.stock_value_at_list_price)}</p>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat icon={<Package className="h-5 w-5" />} label="Produits" value={s.products_count} to="/products" tone="blue" />
              <Stat icon={<Package className="h-5 w-5" />} label="Produits actifs" value={s.active_products_count} to="/products" tone="green" />
              <Stat icon={<Tags className="h-5 w-5" />} label="Catégories" value={s.categories_count} to="/categories" tone="violet" />
              <Stat icon={<Warehouse className="h-5 w-5" />} label="Entrepôts actifs" value={s.warehouses_count} to="/warehouses" tone="slate" />
              <Stat icon={<Users className="h-5 w-5" />} label="Clients" value={s.customers_count} to="/customers" tone="blue" />
              <Stat icon={<ClipboardList className="h-5 w-5" />} label="Fournisseurs" value={s.suppliers_count} to="/suppliers" tone="violet" />
              <Stat icon={<PackageX className="h-5 w-5" />} label="Produits en rupture" value={s.products_out_of_stock} to="/stock-levels" tone={s.products_out_of_stock ? "red" : "slate"} />
              <Stat icon={<AlertTriangle className="h-5 w-5" />} label="Stock faible" value={s.products_low_stock} to="/stock-levels" tone={s.products_low_stock ? "amber" : "slate"} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card><CardHeader><CardTitle>Commandes de vente par statut</CardTitle></CardHeader><CardContent><StatusChart data={sales} colors={SALES_COLORS} /></CardContent></Card>
              <Card><CardHeader><CardTitle>Commandes d'achat par statut</CardTitle></CardHeader><CardContent><StatusChart data={purchases} colors={PURCHASE_COLORS} /></CardContent></Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Indicateurs d'inventaire</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-48" role="img" aria-label="Produits actifs, stock faible et ruptures">
                    <ResponsiveContainer>
                      <BarChart data={inventory} layout="vertical" margin={{ left: 20, right: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="value" name="Produits" radius={[0, 6, 6, 0]} maxBarSize={28}>
                          <Cell fill="#2563eb" /><Cell fill="#d97706" /><Cell fill="#dc2626" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Actions rapides</CardTitle></CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {can("sales.write") && <QuickLink to="/sales-orders/new" icon={<ShoppingCart className="h-4 w-4" />} label="Nouvelle commande de vente" />}
                  {can("purchasing.write") && <QuickLink to="/purchase-orders/new" icon={<Truck className="h-4 w-4" />} label="Nouvelle commande d'achat" />}
                  {can("catalog.write") && <QuickLink to="/products" icon={<Package className="h-4 w-4" />} label="Gérer les produits" />}
                  <QuickLink to="/stock-levels" icon={<Boxes className="h-4 w-4" />} label="Consulter le stock" />
                </CardContent>
              </Card>
            </div>
            {can("audit.view") && <RecentActivity />}
          </div>
        );
      })()}
    </>
  );
}
