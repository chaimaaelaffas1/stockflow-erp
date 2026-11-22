import { describe, expect, it } from "vitest";
import { compareDecimals, lineTotal, scaledToString, sumDecimals, toScaled } from "./decimal";
import { formatAmount, formatQuantity } from "./format";

describe("arithmétique décimale", () => {
  it("évite les erreurs de flottants", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumDecimals(["0.10", "0.20"])).toBe("0.30");
  });
  it("calcule quantité × prix avec arrondi à 2 décimales", () => {
    expect(lineTotal("25.000", "50.00")).toBe("1250.00");
    expect(lineTotal("0.333", "10.00")).toBe("3.33");
    expect(lineTotal("1.500", "0.30")).toBe("0.45");
  });
  it("retourne null quand une donnée manque (prix non figé)", () => {
    expect(lineTotal("2.000", null)).toBeNull();
    expect(sumDecimals(["1.00", null])).toBeNull();
  });
  it("analyse les chaînes décimales", () => {
    expect(toScaled("12.5")).toBe(1250000n);
    expect(toScaled("abc")).toBeNull();
    expect(toScaled("")).toBeNull();
    expect(scaledToString(toScaled("-1.005")!, 2)).toBe("-1.01");
  });
  it("compare", () => {
    expect(compareDecimals("2.000", "10.000")).toBe(-1);
    expect(compareDecimals("5", "5.000")).toBe(0);
  });
  it("formate montants et quantités", () => {
    expect(formatAmount("12500")).toBe("12\u202f500,00");
    expect(formatAmount(null)).toBe("—");
    expect(formatQuantity("10.000")).toBe("10");
    expect(formatQuantity("2.500")).toBe("2,5");
  });
});
