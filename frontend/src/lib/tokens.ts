/**
 * Stockage des jetons JWT.
 * - access  : en MÉMOIRE uniquement (jamais écrit sur disque, durée de vie 15 min).
 * - refresh : sessionStorage (survit au rechargement de page, effacé à la fermeture de l'onglet).
 * Compromis : un XSS pourrait lire sessionStorage. Le backend renvoie le refresh dans le corps JSON
 * (pas de cookie HttpOnly), donc c'est le meilleur équilibre sans modifier le backend.
 */
const REFRESH_KEY = "stockflow.refresh";
let accessToken: string | null = null;

export const tokens = {
  getAccess: () => accessToken,
  getRefresh: () => sessionStorage.getItem(REFRESH_KEY),
  set(access: string, refresh?: string) {
    accessToken = access;
    if (refresh) sessionStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    accessToken = null;
    sessionStorage.removeItem(REFRESH_KEY);
  },
};
