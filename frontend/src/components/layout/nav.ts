import { Boxes, ClipboardList, LayoutDashboard, Package, ScrollText, ShoppingCart, Tags, Truck, Users, Warehouse, ArrowLeftRight, UserCog, PackagePlus, type LucideIcon } from "lucide-react";
import type { Permission } from "@/lib/permissions";

export interface NavItem { to: string; label: string; icon: LucideIcon; permission?: Permission }
export interface NavGroup { title: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  { title: "Pilotage", items: [{ to: "/", label: "Tableau de bord", icon: LayoutDashboard }] },
  {
    title: "Ventes & achats",
    items: [
      { to: "/sales-orders", label: "Commandes de vente", icon: ShoppingCart },
      { to: "/purchase-orders", label: "Commandes d'achat", icon: Truck },
      { to: "/receipts", label: "Réceptions", icon: PackagePlus },
    ],
  },
  {
    title: "Stock",
    items: [
      { to: "/stock-levels", label: "Niveaux de stock", icon: Boxes },
      { to: "/stock-movements", label: "Mouvements", icon: ArrowLeftRight },
      { to: "/warehouses", label: "Entrepôts", icon: Warehouse },
    ],
  },
  {
    title: "Référentiels",
    items: [
      { to: "/products", label: "Produits", icon: Package },
      { to: "/categories", label: "Catégories", icon: Tags },
      { to: "/customers", label: "Clients", icon: Users },
      { to: "/suppliers", label: "Fournisseurs", icon: ClipboardList },
    ],
  },
  {
    title: "Administration",
    items: [
      { to: "/users", label: "Utilisateurs", icon: UserCog, permission: "users.manage" },
      { to: "/audit-logs", label: "Journal d'audit", icon: ScrollText, permission: "audit.view" },
    ],
  },
];

export const BREADCRUMB_LABELS: Record<string, string> = Object.fromEntries([
  ...NAV.flatMap((g) => g.items.map((i) => [i.to.slice(1), i.label])),
  ["new", "Nouveau"], ["edit", "Modifier"],
]);
