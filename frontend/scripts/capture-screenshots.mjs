// Prend de VRAIES captures de l'application en cours d'exécution (http://localhost:5173).
// Usage : voir docs/project-guide/screenshots/README.md
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE_URL ?? "http://localhost:5173";
const EMAIL = process.env.SHOT_EMAIL;
const PASSWORD = process.env.SHOT_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("Définissez SHOT_EMAIL et SHOT_PASSWORD.");
  process.exit(1);
}
const OUT = path.resolve("..", "docs", "project-guide", "screenshots");
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["02-dashboard", "/"], ["03-products", "/products"], ["04-customers", "/customers"], ["05-suppliers", "/suppliers"],
  ["06-stock-levels", "/stock-levels"], ["07-stock-movements", "/stock-movements"], ["08-warehouses", "/warehouses"],
  ["09-sales-orders", "/sales-orders"], ["10-purchase-orders", "/purchase-orders"], ["11-users", "/users"], ["12-audit-logs", "/audit-logs"],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "fr-FR" });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`);
await page.screenshot({ path: path.join(OUT, "01-login.png") });
await page.getByLabel("Adresse e-mail").fill(EMAIL);
await page.getByLabel("Mot de passe").fill(PASSWORD);
await page.getByRole("button", { name: "Se connecter" }).click();
await page.getByRole("heading", { name: "Tableau de bord" }).waitFor();

for (const [name, url] of PAGES) {
  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log("capturé", name);
}

// Pages de détail : on ouvre la première ligne disponible (nécessite des données, ex. une commande créée).
async function detail(name, listUrl, linkSelector, heading) {
  try {
    await page.goto(`${BASE}${listUrl}`);
    await page.locator(linkSelector).first().click({ timeout: 5000 });
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log("capturé", name);
  } catch {
    console.warn(`ignoré ${name} : ${heading} (créez d'abord une commande puis relancez)`);
  }
}
await detail("14-sales-order-detail", "/sales-orders", 'tbody a[href^="/sales-orders/"]', "aucune commande de vente");
await detail("15-purchase-order-detail", "/purchase-orders", 'tbody a[href^="/purchase-orders/"]', "aucune commande d'achat");

try {
  await page.goto(`${BASE}/products`);
  await page.getByRole("button", { name: /Nouveau produit/ }).click({ timeout: 5000 });
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: path.join(OUT, "16-product-form.png") });
  console.log("capturé 16-product-form");
  await page.keyboard.press("Escape");
} catch {
  console.warn("ignoré 16-product-form : bouton « Nouveau produit » introuvable (rôle sans droit d'écriture ?)");
}

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
const m = await mobile.newPage();
await m.goto(`${BASE}/login`);
await m.getByLabel("Adresse e-mail").fill(EMAIL);
await m.getByLabel("Mot de passe").fill(PASSWORD);
await m.getByRole("button", { name: "Se connecter" }).click();
await m.getByRole("heading", { name: "Tableau de bord" }).waitFor();
await m.waitForLoadState("networkidle");
await m.screenshot({ path: path.join(OUT, "13-mobile-dashboard.png") });
await browser.close();
console.log("Terminé →", OUT);
