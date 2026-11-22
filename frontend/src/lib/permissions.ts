export type Role = "ADMIN" | "STOCK_MANAGER" | "SALES" | "PURCHASER" | "VIEWER";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  STOCK_MANAGER: "Responsable stock",
  SALES: "Commercial",
  PURCHASER: "Acheteur",
  VIEWER: "Lecteur",
};

/**
 * Matrice de permissions — miroir de l'audit (docs/project-guide/00-backend-audit.md §3).
 * Elle ne sert qu'à l'ergonomie : le backend reste l'autorité (403 si interdit).
 */
const A: Role = "ADMIN";
export const PERMISSIONS = {
  "users.manage": [A],
  "audit.view": [A],
  "customers.write": [A, "SALES"],
  "customers.delete": [A],
  "suppliers.write": [A, "PURCHASER"],
  "suppliers.delete": [A],
  "catalog.write": [A, "STOCK_MANAGER"],
  "categories.delete": [A],
  "warehouses.write": [A, "STOCK_MANAGER"],
  "stock.adjust": [A, "STOCK_MANAGER"],
  "sales.write": [A, "SALES"],
  "sales.ship": [A, "STOCK_MANAGER"],
  "purchasing.write": [A, "PURCHASER"],
  "purchasing.receive": [A, "STOCK_MANAGER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
