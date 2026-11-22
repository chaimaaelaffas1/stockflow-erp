import { describe, expect, it } from "vitest";
import { can, PERMISSIONS, type Role } from "./permissions";

describe("matrice de permissions", () => {
  it("réserve utilisateurs et audit à ADMIN", () => {
    for (const r of ["STOCK_MANAGER", "SALES", "PURCHASER", "VIEWER"] as Role[]) {
      expect(can(r, "users.manage")).toBe(false);
      expect(can(r, "audit.view")).toBe(false);
    }
    expect(can("ADMIN", "users.manage")).toBe(true);
  });
  it("sépare expédition (SM) et confirmation (SALES)", () => {
    expect(can("SALES", "sales.write")).toBe(true);
    expect(can("SALES", "sales.ship")).toBe(false);
    expect(can("STOCK_MANAGER", "sales.ship")).toBe(true);
    expect(can("STOCK_MANAGER", "sales.write")).toBe(false);
  });
  it("sépare achats (PURCHASER) et réception (SM)", () => {
    expect(can("PURCHASER", "purchasing.write")).toBe(true);
    expect(can("PURCHASER", "purchasing.receive")).toBe(false);
    expect(can("STOCK_MANAGER", "purchasing.receive")).toBe(true);
  });
  it("VIEWER n'a aucun droit d'écriture", () => {
    for (const p of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) expect(can("VIEWER", p)).toBe(false);
  });
  it("refuse sans rôle", () => expect(can(undefined, "sales.write")).toBe(false));
});
