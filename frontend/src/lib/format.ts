import { scaledToString, toScaled } from "./decimal";

function group(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
}

/** Montant à 2 décimales avec séparateur de milliers. Aucune devise n'est inventée : l'API n'en fournit pas. */
export function formatAmount(value: string | null | undefined): string {
  const s = toScaled(value);
  if (s === null) return "—";
  const text = scaledToString(s, 2);
  const neg = text.startsWith("-");
  const [int, frac] = (neg ? text.slice(1) : text).split(".");
  return `${neg ? "-" : ""}${group(int)},${frac}`;
}

/** Quantité (jusqu'à 3 décimales, zéros inutiles retirés). */
export function formatQuantity(value: string | null | undefined): string {
  const s = toScaled(value);
  if (s === null) return "—";
  const text = scaledToString(s, 3).replace(/\.?0+$/, "");
  const neg = text.startsWith("-");
  const [int, frac] = (neg ? text.slice(1) : text).split(".");
  return `${neg ? "-" : ""}${group(int)}${frac ? "," + frac : ""}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso));
}
