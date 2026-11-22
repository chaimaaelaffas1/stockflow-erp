/**
 * Arithmétique décimale exacte.
 * L'API renvoie les décimaux sous forme de chaînes ("25.000"). On évite les flottants JS
 * (0.1 + 0.2 !== 0.3) en travaillant sur des BigInt à 5 décimales.
 */
const SCALE = 5;
const FACTOR = 10n ** BigInt(SCALE);

export type DecimalString = string;

export function toScaled(value: string | number | null | undefined): bigint | null {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).trim();
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(str);
  if (!match || (match[2] === "" && (match[3] ?? "") === "")) return null;
  const [, sign, int, frac = ""] = match;
  const padded = (frac + "0".repeat(SCALE)).slice(0, SCALE);
  const n = BigInt((int || "0") + padded);
  return sign === "-" ? -n : n;
}

export function mulScaled(a: bigint, b: bigint): bigint {
  const product = a * b;
  const half = FACTOR / 2n;
  return product >= 0n ? (product + half) / FACTOR : (product - half) / FACTOR;
}

/** Texte à `decimals` décimales (arrondi half-up, valeurs positives et négatives). */
export function scaledToString(value: bigint, decimals = 2): string {
  const negative = value < 0n;
  let abs = negative ? -value : value;
  const drop = BigInt(SCALE - decimals);
  if (drop > 0n) {
    const div = 10n ** drop;
    abs = (abs + div / 2n) / div;
  }
  const s = abs.toString().padStart(decimals + 1, "0");
  const int = decimals === 0 ? s : s.slice(0, -decimals);
  const frac = decimals === 0 ? "" : "." + s.slice(-decimals);
  return (negative && abs !== 0n ? "-" : "") + int + frac;
}

/** quantité × prix unitaire → total à 2 décimales, ou null si une donnée manque. */
export function lineTotal(quantity: string | null, unitPrice: string | null): string | null {
  const q = toScaled(quantity);
  const p = toScaled(unitPrice);
  if (q === null || p === null) return null;
  return scaledToString(mulScaled(q, p), 2);
}

export function sumDecimals(values: Array<string | null>): string | null {
  let total = 0n;
  for (const v of values) {
    const s = toScaled(v);
    if (s === null) return null;
    total += s;
  }
  return scaledToString(total, 2);
}

export function compareDecimals(a: string, b: string): number {
  const x = toScaled(a);
  const y = toScaled(b);
  if (x === null || y === null) return 0;
  return x === y ? 0 : x > y ? 1 : -1;
}
