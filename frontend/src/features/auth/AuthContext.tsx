import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchMe, login as apiLogin, logout as apiLogout } from "@/api/auth";
import { refreshAccessToken, setAuthFailureHandler } from "@/api/client";
import { tokens } from "@/lib/tokens";
import { can as canDo, type Permission } from "@/lib/permissions";
import type { Me } from "@/types/api";

type Status = "loading" | "authenticated" | "anonymous";
interface AuthValue {
  user: Me | null;
  status: Status;
  /** true si la déconnexion vient d'une expiration de session (pour afficher un message au login) */
  expired: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (p: Permission) => boolean;
}
const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<Me | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [expired, setExpired] = useState(false);

  // Restauration de session au chargement : l'access token (en mémoire) est perdu au refresh de page,
  // on le régénère à partir du refresh token conservé dans sessionStorage.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!tokens.getRefresh()) return alive && setStatus("anonymous");
      try {
        await refreshAccessToken();
        const me = await fetchMe();
        if (alive) { setUser(me); setStatus("authenticated"); }
      } catch {
        tokens.clear();
        if (alive) setStatus("anonymous");
      }
    })();
    return () => { alive = false; };
  }, []);

  // Appelé par l'intercepteur Axios quand le refresh échoue (session expirée / jeton révoqué).
  useEffect(() => {
    setAuthFailureHandler(() => {
      setUser(null);
      setStatus("anonymous");
      setExpired(true);
      qc.clear();
    });
    return () => setAuthFailureHandler(null);
  }, [qc]);

  const login = useCallback(async (email: string, password: string) => {
    const me = await apiLogin(email, password);
    setExpired(false);
    setUser(me);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setStatus("anonymous");
    setExpired(false);
    qc.clear(); // aucune donnée de l'ancien utilisateur ne doit rester en cache
  }, [qc]);

  const value = useMemo<AuthValue>(
    () => ({ user, status, expired, login, logout, can: (p) => canDo(user?.role, p) }),
    [user, status, expired, login, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return v;
}
