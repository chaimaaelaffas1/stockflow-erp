import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { tokens } from "@/lib/tokens";

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Instance « nue » (sans intercepteurs) pour le refresh : évite toute boucle infinie.
const bare = axios.create({ baseURL: API_BASE_URL, headers: { "Content-Type": "application/json" } });

type Retriable = InternalAxiosRequestConfig & { _retry?: boolean };

let onAuthFailure: (() => void) | null = null;
export function setAuthFailureHandler(fn: (() => void) | null) {
  onAuthFailure = fn;
}

const isAuthUrl = (url?: string) => !!url && /\/auth\/(token\/?$|token\/refresh)/.test(url);

api.interceptors.request.use((config) => {
  const access = tokens.getAccess();
  if (access && !isAuthUrl(config.url)) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

/**
 * Une seule requête de refresh à la fois : si 5 requêtes reçoivent un 401 en même temps,
 * elles attendent TOUTES la même promesse. Indispensable car le refresh token est rotatif
 * (BLACKLIST_AFTER_ROTATION) : un second refresh avec l'ancien jeton serait rejeté.
 */
let refreshing: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (refreshing) return refreshing;
  const refresh = tokens.getRefresh();
  if (!refresh) return Promise.reject(new Error("no_refresh_token"));
  const promise = bare
    .post<{ access: string; refresh?: string }>("/auth/token/refresh/", { refresh })
    .then(({ data }) => {
      tokens.set(data.access, data.refresh); // rotation : on stocke le NOUVEAU refresh
      return data.access;
    })
    .finally(() => {
      refreshing = null;
    });
  refreshing = promise;
  return promise;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as Retriable | undefined;
    if (error.response?.status === 401 && original && !original._retry && !isAuthUrl(original.url)) {
      original._retry = true;
      try {
        const access = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch {
        tokens.clear();
        onAuthFailure?.(); // session expirée → retour au login
      }
    }
    return Promise.reject(error);
  },
);

/** Retire les paramètres vides pour ne pas envoyer `?search=&is_active=`. */
export function clean(params: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
}
