// Hiper (Mit Hiper) – flow_version 1. Deterministiske selectors, ingen AI-navigation.
// Login-selectors er aflæst fra den offentlige loginside 25/10-2026. Siden efter login og
// fakturasidens layout er IKKE verificeret med et rigtigt login: alt uventet giver PORTAL_LAYOUT.
// deno-lint-ignore-file no-explicit-any
import { PortalError, parsePortalAmount, parsePortalDate, periodOf } from "../invoiceflowPortalPeriods.ts";
import { INVOICE_REACH_MS, LoginProbe } from "../invoiceflowCodeWait.ts";

export const HIPER = {
  loginUrl: "https://www.hiper.dk/mit-hiper/login",
  cookieDecline: "#declineButton",
  email: "#selfcare-login__email",
  password: "#selfcare-login__password",
  rememberMe: 'input[name="remember_me"]',
  rememberDevice: 'label:has-text("Husk denne enhed"), button:has-text("Husk denne enhed"), input[name*="remember" i]',
  submit: 'form:has(#selfcare-login__password) [type="submit"]',
  loginError: ".selfcare-login__error, [role=alert]",
  codeHints: /engangskode|bekræftelseskode|verifikationskode|sms-kode|indtast koden/i,
  invoiceLink: 'a:has-text("Faktura"), a:has-text("Betaling")',
  invoiceRow: "[data-invoice-id], table tbody tr",
  logout: 'a:has-text("Log ud"), button:has-text("Log ud")',
};

export type PortalInvoice = { bytes: Uint8Array; invoiceNumber: string | null; invoiceDate: string | null; amountInclVat: number | null };
export type Shot = (name: string) => Promise<void>;
export type PortalMode = "test" | "keepalive" | "fetch";

async function codeRequested(page: any) {
  const txt: string = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  const otp = await page.locator('input[autocomplete="one-time-code"]').count().catch(() => 0);
  return otp > 0 || HIPER.codeHints.test(txt);
}

/** Bruges af ventemodellen: er vi forbi login (fakturalink synligt og ingen kode-side)? */
export async function probeHiper(page: any): Promise<LoginProbe> {
  if (await codeRequested(page)) return "code";
  if (page.url().includes("/login")) return "code";
  return (await page.locator(HIPER.invoiceLink).count().catch(() => 0)) ? "logged_in" : "code";
}

/** Login. Returnerer "code", hvis portalen beder om engangskode eller fakturasiden ikke nås inden 20 sek. */
export async function loginHiper(page: any, creds: Record<string, string>, shot: Shot): Promise<LoginProbe> {
  await page.goto(HIPER.loginUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator(HIPER.cookieDecline).click({ timeout: 4000 }).catch(() => {});
  if (!page.url().includes("/login")) return probeHiper(page); // persistent context allerede logget ind
  const email = page.locator(HIPER.email);
  if (!(await email.count())) { await shot("login-layout"); throw new PortalError("PORTAL_LAYOUT", "Hiper-loginsiden har uventet layout"); }
  await email.fill(creds.email);
  await page.locator(HIPER.password).fill(creds.password);
  await page.locator(HIPER.rememberMe).check({ timeout: 2000 }).catch(() => {});
  await page.locator(HIPER.submit).first().click();
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  if (page.url().includes("/login") && !(await codeRequested(page)) && (await page.locator(HIPER.loginError).count())) {
    throw new PortalError("PORTAL_LOGIN_FAILED", "Hiper afviste loginnet");
  }
  const reached = await page.locator(HIPER.invoiceLink).first().waitFor({ state: "visible", timeout: INVOICE_REACH_MS }).then(() => true, () => false);
  if (reached && !(await codeRequested(page))) return "logged_in";
  return "code";
}

async function openInvoices(page: any, shot: Shot) {
  const link = page.locator(HIPER.invoiceLink).first();
  if (!(await link.count())) { await shot("no-invoice-link"); throw new PortalError("PORTAL_LAYOUT", "Fandt ikke fakturasiden"); }
  await link.click();
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  if (!(await page.locator(HIPER.invoiceRow).count())) { await shot("no-invoice-rows"); throw new PortalError("PORTAL_LAYOUT", "Fakturalisten har uventet layout"); }
}

async function logout(page: any) {
  await page.locator(HIPER.logout).first().click({ timeout: 5000 }).catch(() => {});
}

/** Efter gennemført login: (husk enhed) → fakturaside → evt. download → log ud. */
export async function afterLoginHiper(page: any, mode: PortalMode, periods: string[], shot: Shot, afterCode = false): Promise<PortalInvoice[]> {
  try {
    if (afterCode) await page.locator(HIPER.rememberDevice).first().click({ timeout: 2000 }).catch(() => {});
    if (mode === "keepalive") return [];
    await openInvoices(page, shot);
    if (mode === "test") return [];
    const out: PortalInvoice[] = [];
    const rows = page.locator(HIPER.invoiceRow);
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      const row = rows.nth(i);
      const cells: string[] = await row.locator("td, [data-field]").allInnerTexts().catch(() => []);
      const invoiceDate = cells.map(parsePortalDate).find((d) => d) ?? null;
      if (!invoiceDate || !periods.includes(periodOf(invoiceDate)!)) continue;
      const pdf = row.locator('a[href$=".pdf"], a:has-text("PDF"), a:has-text("Download"), button:has-text("PDF")').first();
      if (!(await pdf.count())) { await shot("no-pdf-link"); throw new PortalError("PORTAL_LAYOUT", "Fandt ikke PDF-link på fakturalinje"); }
      const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), pdf.click()]);
      const stream = await dl.createReadStream();
      const chunks: Uint8Array[] = [];
      for await (const c of stream) chunks.push(c as Uint8Array);
      const bytes = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
      let o = 0; for (const c of chunks) { bytes.set(c, o); o += c.length; }
      if (!(bytes[0] === 0x25 && bytes[1] === 0x50)) throw new PortalError("PORTAL_LAYOUT", "Download var ikke en PDF");
      const invoiceNumber = cells.map((c) => c.trim()).find((c) => /^\d{5,}$/.test(c)) ?? null;
      const amountInclVat = cells.map(parsePortalAmount).find((a) => a !== null) ?? null;
      out.push({ bytes, invoiceNumber, invoiceDate, amountInclVat });
    }
    return out;
  } finally {
    await logout(page);
  }
}

export const hiperModule = { login: loginHiper, probe: probeHiper, afterLogin: afterLoginHiper };
