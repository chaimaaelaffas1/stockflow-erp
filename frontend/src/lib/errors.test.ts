import { AxiosError, type AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { normalizeError } from "./errors";

function axiosErr(status: number, data: unknown) {
  return new AxiosError("x", "ERR", undefined, undefined, { status, data } as AxiosResponse);
}

describe("normalizeError", () => {
  it("lit l'enveloppe standard avec erreurs de champ (400)", () => {
    const e = normalizeError(axiosErr(400, { error: { code: "validation_error", message: "Validation failed.", details: { sku: ["A product with this SKU already exists."] } } }));
    expect(e.code).toBe("validation_error");
    expect(e.fieldErrors.sku).toEqual(["A product with this SKU already exists."]);
  });
  it("traduit les erreurs métier (409)", () => {
    const e = normalizeError(axiosErr(409, { error: { code: "insufficient_stock", message: "Not enough available stock.", details: {} } }));
    expect(e.message).toContain("Stock disponible insuffisant");
  });
  it("gère le 409 de suppression de catégorie, hors enveloppe", () => {
    const e = normalizeError(axiosErr(409, { code: "resource_in_use", detail: "This category cannot be deleted because it is used by products." }));
    expect(e.code).toBe("resource_in_use");
    expect(e.message).toContain("utilisé");
  });
  it("gère 401 SimpleJWT, 403, 429 et 500", () => {
    expect(normalizeError(axiosErr(401, { detail: "Token is invalid", code: "token_not_valid" })).status).toBe(401);
    expect(normalizeError(axiosErr(403, { error: { code: "permission_denied", message: "Request failed.", details: { detail: "x" } } })).message).toMatch(/permission/);
    expect(normalizeError(axiosErr(429, { detail: "Request was throttled." })).code).toBe("throttled");
    expect(normalizeError(axiosErr(500, "<html>")).message).toMatch(/serveur/);
  });
  it("détecte une erreur réseau", () => {
    expect(normalizeError(new AxiosError("Network Error")).code).toBe("network_error");
  });
});
