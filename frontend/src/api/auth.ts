import type { Me } from "@/types/api";
import { api, API_BASE_URL } from "./client";
import axios from "axios";
import { tokens } from "@/lib/tokens";

export async function login(email: string, password: string): Promise<Me> {
  const { data } = await api.post<{ access: string; refresh: string }>("/auth/token/", { email, password });
  tokens.set(data.access, data.refresh);
  return fetchMe();
}

export async function fetchMe(): Promise<Me> {
  const { data } = await api.get<Me>("/auth/me/");
  return data;
}

/** Blackliste le refresh côté serveur, puis efface tout côté client (même si le serveur échoue). */
export async function logout(): Promise<void> {
  const refresh = tokens.getRefresh();
  const access = tokens.getAccess();
  try {
    if (refresh && access) {
      await axios.post(`${API_BASE_URL}/auth/logout/`, { refresh }, { headers: { Authorization: `Bearer ${access}` } });
    }
  } catch {
    /* le jeton expirera de toute façon ; on se déconnecte localement */
  } finally {
    tokens.clear();
  }
}
