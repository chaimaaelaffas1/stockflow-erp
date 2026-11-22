import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeMe, renderApp, seedSession } from "@/test/render";
import { API, server } from "@/test/server";
import type { Role } from "@/lib/permissions";
import { tokens } from "@/lib/tokens";

const SUMMARY = {
  products_count: 3, active_products_count: 2, categories_count: 1, customers_count: 4, suppliers_count: 2, warehouses_count: 1,
  products_out_of_stock: 1, products_low_stock: 0, stock_value_at_list_price: "1250", sales_orders_by_status: { DRAFT: 2 }, purchase_orders_by_status: {},
};

function mockSession(role: Role) {
  seedSession();
  server.use(
    http.post(`${API}/auth/token/refresh/`, () => HttpResponse.json({ access: "access-new", refresh: "refresh-2" })),
    http.get(`${API}/auth/me/`, () => HttpResponse.json(makeMe(role))),
    http.get(`${API}/dashboard/summary/`, () => HttpResponse.json(SUMMARY)),
    http.get(`${API}/dashboard/audit-logs/`, () => HttpResponse.json({ count: 0, next: null, previous: null, results: [] })),
  );
}

describe("authentification", () => {
  it("redirige un visiteur anonyme vers /login", async () => {
    renderApp("/products");
    expect(await screen.findByRole("heading", { name: "Connexion" })).toBeInTheDocument();
  });

  it("valide les champs du formulaire de connexion", async () => {
    renderApp("/login");
    await userEvent.click(await screen.findByRole("button", { name: "Se connecter" }));
    expect(await screen.findByText("L'e-mail est requis")).toBeInTheDocument();
    expect(screen.getByText("Le mot de passe est requis")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Adresse e-mail"), "pas-un-email");
    await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByText("E-mail invalide")).toBeInTheDocument();
  });

  it("affiche une erreur claire si les identifiants sont faux", async () => {
    server.use(http.post(`${API}/auth/token/`, () => HttpResponse.json({ detail: "No active account found" }, { status: 401 })));
    renderApp("/login");
    await userEvent.type(await screen.findByLabelText("Adresse e-mail"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Mot de passe"), "mauvais");
    await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou mot de passe incorrect.");
  });

  it("connecte l'utilisateur, charge /auth/me/ et ouvre le dashboard", async () => {
    server.use(
      http.post(`${API}/auth/token/`, async ({ request }) => {
        expect(await request.json()).toEqual({ email: "admin@example.com", password: "secret" });
        return HttpResponse.json({ access: "acc", refresh: "ref" });
      }),
      http.get(`${API}/auth/me/`, ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer acc");
        return HttpResponse.json(makeMe("ADMIN"));
      }),
      http.get(`${API}/dashboard/summary/`, () => HttpResponse.json(SUMMARY)),
      http.get(`${API}/dashboard/audit-logs/`, () => HttpResponse.json({ count: 0, next: null, previous: null, results: [] })),
    );
    renderApp("/login");
    await userEvent.type(await screen.findByLabelText("Adresse e-mail"), "admin@example.com");
    await userEvent.type(screen.getByLabelText("Mot de passe"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByRole("heading", { name: "Tableau de bord" })).toBeInTheDocument();
    expect(tokens.getRefresh()).toBe("ref");
  });

  it("restaure la session au rechargement via le refresh token", async () => {
    mockSession("SALES");
    renderApp("/");
    expect(await screen.findByRole("heading", { name: "Tableau de bord" })).toBeInTheDocument();
  });

  it("se déconnecte : blackliste le refresh puis revient au login", async () => {
    mockSession("ADMIN");
    let body: unknown = null;
    server.use(http.post(`${API}/auth/logout/`, async ({ request }) => { body = await request.json(); return new HttpResponse(null, { status: 204 }); }));
    renderApp("/");
    await userEvent.click(await screen.findByRole("button", { name: "Se déconnecter" }));
    expect(await screen.findByRole("heading", { name: "Connexion" })).toBeInTheDocument();
    expect(body).toEqual({ refresh: "refresh-2" });
    expect(tokens.getRefresh()).toBeNull();
  });
});

describe("navigation selon le rôle", () => {
  it("ADMIN voit Utilisateurs et Journal d'audit", async () => {
    mockSession("ADMIN");
    renderApp("/");
    const nav = await screen.findByRole("navigation", { name: "Navigation principale" });
    expect(nav).toHaveTextContent("Utilisateurs");
    expect(nav).toHaveTextContent("Journal d'audit");
  });

  it("VIEWER ne voit pas l'administration et reçoit « Accès non autorisé » sur /users", async () => {
    mockSession("VIEWER");
    renderApp("/users");
    expect(await screen.findByRole("heading", { name: "Accès non autorisé" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Navigation principale" });
    expect(nav).not.toHaveTextContent("Utilisateurs");
    expect(nav).not.toHaveTextContent("Journal d'audit");
    expect(nav).toHaveTextContent("Produits");
  });
});
