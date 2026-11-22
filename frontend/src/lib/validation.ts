import { z } from "zod";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toScaled } from "./decimal";
import { normalizeError } from "./errors";

/**
 * Champ décimal saisi par l'utilisateur. Accepte la virgule française ("12,5"), normalise en "12.5"
 * (format attendu par DRF) et vérifie le nombre de décimales maximal et le signe.
 */
export function decimalField(opts: { dp: number; min?: "positive" | "nonNegative" | "any"; label?: string }) {
  const { dp, min = "nonNegative", label = "Valeur" } = opts;
  const re = new RegExp(`^-?\\d+(\\.\\d{1,${dp}})?$`);
  return z
    .string()
    .trim()
    .min(1, `${label} requis`)
    .transform((s) => s.replace(",", "."))
    .pipe(
      z
        .string()
        .regex(re, `Nombre invalide (${dp} décimale${dp > 1 ? "s" : ""} max)`)
        .refine((s) => {
          const n = toScaled(s);
          if (n === null) return false;
          if (min === "positive") return n > 0n;
          if (min === "nonNegative") return n >= 0n;
          return true;
        }, min === "positive" ? "Doit être supérieur à 0" : min === "nonNegative" ? "Doit être positif ou nul" : "Valeur invalide"),
    );
}

/**
 * Reporte les erreurs 400 de l'API sur les champs du formulaire.
 * Retourne le message à afficher en bandeau (erreur non rattachée à un champ), ou null.
 */
export function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, known: string[]): string | null {
  const e = normalizeError(err);
  let general: string | null = null;
  for (const [field, msgs] of Object.entries(e.fieldErrors)) {
    if (known.includes(field)) setError(field as Path<T>, { type: "server", message: msgs.join(" ") });
    else general = (general ? general + " " : "") + msgs.join(" ");
  }
  return general ?? (Object.keys(e.fieldErrors).length ? null : e.message);
}
