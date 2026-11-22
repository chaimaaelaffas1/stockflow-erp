import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeMe, renderApp, seedSession } from "@/test/render";
import { API, server } from "@/test/server";
import { SalesDetailPage } from "@/features/sales/SalesPages";
import { PurchaseDetailPage } from "@/features/purchasing/PurchasingPages";
import { Pagination } from "@/components/common/common";
import { ProductsPage } from "@/features/catalog/ProductsPage";
import type { Role } from "@/lib/permissions";

const session = (role: Role) => {
  seedSession();
  server.use(
    http.post(`${API}/auth/token/refresh/`, () => HttpResponse.json({ access: "a", refresh: "r2" })),
    http.get(`${API}/auth/me/`, () => HttpResponse.json(makeMe(role))),
  );
};
const order = (status: string) => ({
  id: 7, number: "SO-000007", customer: 1, customer_name: "Acme", warehouse: 1, warehouse_name: "Principal", status, notes: "", created_by: 1,
  created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-01T10:00:00Z", confirmed_at: null, shipped_at: null, cancelled_at: null,
  lines: [{ id: 1, product: 1, product_name: "Marteau", quantity: "2.000", unit_price: null, line_total: null }], total: null as string | null,
});

describe("workflow commande de vente", () => {
  it("SALES confirme un brouillon via l'endpoint dédié (et n'a pas le bouton Expédier)", async () => {
    session("SALES");
    let current = order("DRAFT");
    let confirmCalls = 0;
    server.use(
      http.get(`${API}/sales/sales-orders/7/`, () => HttpResponse.json(current)),
      http.post(`${API}/sales/sales-orders/7/confirm/`, () => { confirmCalls++; current = { ...order("CONFIRMED"), total: "170.000" }; return HttpResponse.json(current); }),
    );
    renderApp("/sales-orders/7", <Routes><Route path="/sales-orders/:id" element={<SalesDetailPage />} /></Routes>);
    expect(await screen.findByText("SO-000007")).toBeInTheDocument();
    expect(screen.getByText("à la confirmation")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirmer la commande" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmer" }));
    await waitFor(() => expect(confirmCalls).toBe(1));
    expect(await screen.findByText("Commande confirmée")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expédier" })).not.toBeInTheDocument();
  });

  it("STOCK_MANAGER voit Expédier sur une commande confirmée, mais pas Confirmer", async () => {
    session("STOCK_MANAGER");
    server.use(http.get(`${API}/sales/sales-orders/7/`, () => HttpResponse.json(order("CONFIRMED"))));
    renderApp("/sales-orders/7", <Routes><Route path="/sales-orders/:id" element={<SalesDetailPage />} /></Routes>);
    expect(await screen.findByRole("button", { name: "Expédier" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Annuler" })).not.toBeInTheDocument();
  });

  it("affiche l'erreur 409 de stock insuffisant renvoyée par le serveur", async () => {
    session("SALES");
    server.use(
      http.get(`${API}/sales/sales-orders/7/`, () => HttpResponse.json(order("DRAFT"))),
      http.post(`${API}/sales/sales-orders/7/confirm/`, () => HttpResponse.json({ error: { code: "insufficient_stock", message: "Not enough available stock.", details: {} } }, { status: 409 })),
    );
    renderApp("/sales-orders/7", <Routes><Route path="/sales-orders/:id" element={<SalesDetailPage />} /></Routes>);
    await userEvent.click(await screen.findByRole("button", { name: "Confirmer" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirmer" }));
    expect(await screen.findByText(/Stock disponible insuffisant/)).toBeInTheDocument();
  });
});

describe("réception d'achat", () => {
  const po = {
    id: 3, number: "PO-ABC123", supplier: 1, supplier_name: "Fournisseur", warehouse: 1, warehouse_name: "Principal", status: "ORDERED", ordered_at: "2026-11-02T10:00:00Z", created_by: 1,
    created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-02T10:00:00Z",
    lines: [{ id: 11, product: 1, product_name: "Vis", product_sku: "VIS-001", quantity_ordered: "10.000", quantity_received: "0.000", quantity_remaining: "10.000", unit_cost: "0.50" }],
  };
  const setup = () => {
    session("STOCK_MANAGER");
    server.use(
      http.get(`${API}/purchasing/purchase-orders/3/`, () => HttpResponse.json(po)),
      http.get(`${API}/purchasing/receipts/`, () => HttpResponse.json({ count: 0, next: null, previous: null, results: [] })),
    );
    renderApp("/purchase-orders/3", <Routes><Route path="/purchase-orders/:id" element={<PurchaseDetailPage />} /></Routes>);
  };

  it("refuse côté client une quantité supérieure au restant (aucune requête envoyée)", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Réceptionner" }));
    await userEvent.type(await screen.findByLabelText("Quantité reçue Vis"), "11");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer la réception" }));
    expect(await screen.findByText(/Maximum 10/)).toBeInTheDocument();
  });

  it("envoie une clé d'idempotence UUID et les lignes saisies", async () => {
    setup();
    let payload: { idempotency_key: string; lines: unknown[] } | null = null;
    server.use(http.post(`${API}/purchasing/purchase-orders/3/receive/`, async ({ request }) => {
      payload = (await request.json()) as typeof payload;
      return HttpResponse.json({ id: 1, purchase_order: 3, purchase_order_number: "PO-ABC123", idempotency_key: payload!.idempotency_key, received_by: 1, created_at: "2026-11-03T10:00:00Z", lines: [] }, { status: 201 });
    }));
    await userEvent.click(await screen.findByRole("button", { name: "Réceptionner" }));
    await userEvent.type(await screen.findByLabelText("Quantité reçue Vis"), "4,5");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer la réception" }));
    await waitFor(() => expect(payload).not.toBeNull());
    expect(payload!.idempotency_key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(payload!.lines).toEqual([{ purchase_order_line: 11, quantity: "4.5" }]);
  });
});

describe("pagination", () => {
  it("navigue entre les pages et désactive les bornes", async () => {
    const pages: number[] = [];
    const { rerender } = render(<Pagination page={1} count={45} onPage={(p) => pages.push(p)} />);
    expect(screen.getByText(/45 résultats — page 1 \/ 3/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Précédent/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /Suivant/ }));
    expect(pages).toEqual([2]);
    rerender(<Pagination page={3} count={45} onPage={() => {}} />);
    expect(screen.getByRole("button", { name: /Suivant/ })).toBeDisabled();
  });

  it("la liste produits envoie le numéro de page à l'API", async () => {
    session("VIEWER");
    let meLoaded = false;
    server.use(http.get(`${API}/auth/me/`, () => { meLoaded = true; return HttpResponse.json(makeMe("VIEWER")); }));
    const seen: string[] = [];
    const product = (n: number) => ({ id: n, sku: `P-${n}`, name: `Produit ${n}`, description: "", category: 1, category_name: "Cat", unit_price: "10.00", is_active: true, reorder_level: "0.000", created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" });
    server.use(
      http.get(`${API}/catalog/categories/`, () => HttpResponse.json({ count: 0, next: null, previous: null, results: [] })),
      http.get(`${API}/catalog/products/`, ({ request }) => {
        const page = new URL(request.url).searchParams.get("page") ?? "1";
        seen.push(page);
        return HttpResponse.json({ count: 40, next: null, previous: null, results: [product(Number(page))] });
      }),
    );
    renderApp("/products", <Routes><Route path="/products" element={<ProductsPage />} /></Routes>);
    expect(await screen.findByText("Produit 1")).toBeInTheDocument();
    // On attend que l'utilisateur soit chargé, sinon l'assertion « absent » serait vraie trop tôt (faux positif).
    await waitFor(() => expect(meLoaded).toBe(true));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("button", { name: /Nouveau produit/ })).not.toBeInTheDocument(); // VIEWER : pas d'écriture
    await userEvent.click(screen.getByRole("button", { name: /Suivant/ }));
    expect(await screen.findByText("Produit 2")).toBeInTheDocument();
    expect(seen).toContain("2");
  });
});
