import axios from "axios";

export interface ApiError {
  status: number | null;
  code: string;
  message: string;
  /** Erreurs par champ (400), clés = noms de champs de l'API */
  fieldErrors: Record<string, string[]>;
  details: unknown;
}

const BUSINESS_MESSAGES: Record<string, string> = {
  invalid_transition: "Cette opération n'est pas possible dans l'état actuel.",
  insufficient_stock: "Stock disponible insuffisant.",
  over_receipt: "La quantité reçue dépasse la quantité restante.",
  empty_order: "La commande doit contenir au moins une ligne.",
  idempotency_conflict: "Cette clé d'idempotence a déjà été utilisée avec un autre contenu.",
  resource_in_use: "Cet élément est utilisé ailleurs et ne peut pas être supprimé.",
};

function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap(toList);
  if (typeof v === "string") return [v];
  if (v && typeof v === "object") return Object.values(v).flatMap(toList);
  return [];
}

/** Normalise TOUTES les formes d'erreur rencontrées dans le backend (voir docs/00-backend-audit.md §1). */
export function normalizeError(err: unknown): ApiError {
  if (!axios.isAxiosError(err)) {
    return { status: null, code: "unknown", message: "Une erreur inattendue est survenue.", fieldErrors: {}, details: err };
  }
  if (!err.response) {
    return { status: null, code: "network_error", message: "Impossible de joindre le serveur.", fieldErrors: {}, details: null };
  }
  const { status, data } = err.response as { status: number; data: unknown };
  const body = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;

  // Forme standard : {error: {code, message, details}}
  const env = body.error as { code?: string; message?: string; details?: unknown } | undefined;
  let code = env?.code ?? (typeof body.code === "string" ? body.code : "request_error");
  let message = env?.message ?? (typeof body.detail === "string" ? body.detail : "");
  const details = env?.details ?? body;
  const fieldErrors: Record<string, string[]> = {};

  if (code === "validation_error" || status === 400) {
    if (details && typeof details === "object" && !Array.isArray(details)) {
      for (const [k, v] of Object.entries(details as Record<string, unknown>)) {
        const list = toList(v);
        if (list.length) fieldErrors[k] = list;
      }
    } else {
      const list = toList(details);
      if (list.length) fieldErrors.non_field_errors = list;
    }
    const first = Object.values(fieldErrors).flat()[0];
    message = first ?? message ?? "Données invalides.";
  }
  if (status === 409 && BUSINESS_MESSAGES[code]) {
    const base = BUSINESS_MESSAGES[code];
    message = message && message !== base ? `${base} ${message}` : base;
  }
  if (status === 429) {
    code = "throttled";
    message = "Trop de requêtes. Réessayez dans un instant.";
  }
  if (status === 403) message = "Vous n'avez pas la permission d'effectuer cette action.";
  if (status === 401 && !message) message = "Authentification requise.";
  if (status >= 500) message = "Erreur serveur. Réessayez plus tard.";
  return { status, code, message: message || "Requête refusée.", fieldErrors, details };
}
