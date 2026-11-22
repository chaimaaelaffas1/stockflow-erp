import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { api, setAuthFailureHandler } from "./client";
import { tokens } from "@/lib/tokens";
import { API, server } from "@/test/server";

describe("client Axios — refresh JWT", () => {
  it("ajoute l'en-tête Bearer", async () => {
    tokens.set("tok-1");
    let seen = "";
    server.use(http.get(`${API}/ping/`, ({ request }) => { seen = request.headers.get("authorization") ?? ""; return HttpResponse.json({ ok: true }); }));
    await api.get("/ping/");
    expect(seen).toBe("Bearer tok-1");
  });

  it("rafraîchit UNE seule fois pour plusieurs 401 simultanés, puis rejoue les requêtes", async () => {
    tokens.set("expired", "refresh-1");
    let refreshCalls = 0;
    server.use(
      http.post(`${API}/auth/token/refresh/`, async ({ request }) => {
        refreshCalls++;
        expect(await request.json()).toEqual({ refresh: "refresh-1" });
        return HttpResponse.json({ access: "fresh", refresh: "refresh-2" });
      }),
      http.get(`${API}/data/:n`, ({ request, params }) =>
        request.headers.get("authorization") === "Bearer fresh" ? HttpResponse.json({ n: params.n }) : HttpResponse.json({ detail: "expired" }, { status: 401 }),
      ),
    );
    const res = await Promise.all([api.get("/data/1"), api.get("/data/2"), api.get("/data/3")]);
    expect(res.map((r) => r.data.n)).toEqual(["1", "2", "3"]);
    expect(refreshCalls).toBe(1);
    expect(tokens.getRefresh()).toBe("refresh-2"); // rotation : nouveau refresh stocké
  });

  it("déconnecte quand le refresh échoue", async () => {
    tokens.set("expired", "revoked");
    const onFail = vi.fn();
    setAuthFailureHandler(onFail);
    server.use(
      http.post(`${API}/auth/token/refresh/`, () => HttpResponse.json({ detail: "blacklisted" }, { status: 401 })),
      http.get(`${API}/secure/`, () => HttpResponse.json({ detail: "expired" }, { status: 401 })),
    );
    await expect(api.get("/secure/")).rejects.toBeTruthy();
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(tokens.getAccess()).toBeNull();
    expect(tokens.getRefresh()).toBeNull();
    setAuthFailureHandler(null);
  });

  it("ne tente pas de refresh sur un 401 de login", async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${API}/auth/token/`, () => HttpResponse.json({ detail: "No active account" }, { status: 401 })),
      http.post(`${API}/auth/token/refresh/`, () => { refreshCalls++; return HttpResponse.json({}, { status: 401 }); }),
    );
    await expect(api.post("/auth/token/", { email: "a@b.c", password: "x" })).rejects.toBeTruthy();
    expect(refreshCalls).toBe(0);
  });
});
