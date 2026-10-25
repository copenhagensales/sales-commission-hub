// Kører et portal-flow i Browserbase. Logins dekrypteres kun her og forlader aldrig funktionen.
// Engangskode: sessionen holdes åben (keepAlive), ejeren taster koden i Live View, og
// resumePortal genforbinder og fortsætter, når login er gennemført.
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chromium } from "npm:playwright-core@1.48.2";
import { decryptCredential } from "./invoiceflow.ts";
import { createContext, createSession, releaseSession, sessionConnectUrl } from "./browserbase.ts";
import { PortalError, resolveCatalog } from "./invoiceflowPortalPeriods.ts";
import { waitForLogin } from "./invoiceflowCodeWait.ts";
import { hiperModule, PortalInvoice, PortalMode } from "./portals/hiper.ts";

const MODULES = { hiper: hiperModule } as const;

export type PortalResult =
  | { status: "done"; invoices: PortalInvoice[]; sessionId: string; region: string | null }
  | { status: "awaiting_code"; sessionId: string; region: string | null };

async function catalogFor(svc: SupabaseClient, config: any) {
  const { data: entry } = await svc.from("invoiceflow_portal_catalog").select("slug, status, flow_version, login_fields")
    .eq("slug", config?.catalog_slug ?? "").maybeSingle();
  return resolveCatalog(entry);
}

function shooter(svc: SupabaseClient, sourceId: string, runId: string | null, page: any, onPath: (p: string) => void) {
  return async (name: string) => {
    try {
      // Felter tømmes før screenshot, så login aldrig optræder i billedet
      await page.evaluate(() => document.querySelectorAll("input").forEach((i: any) => { i.value = ""; })).catch(() => {});
      const png = await page.screenshot({ type: "png" });
      const path = `${sourceId}/${runId ?? "test"}-${name}.png`;
      await svc.storage.from("invoiceflow-debug").upload(path, png, { contentType: "image/png", upsert: true });
      onPath(path);
    } catch { /* screenshot må ikke vælte fejlhåndteringen */ }
  };
}

function wrap(e: unknown, screenshotPath: string | null, sessionId: string | null) {
  const pe = e instanceof PortalError ? e : new PortalError("PORTAL_LAYOUT", "Uventet fejl i portal-flowet");
  (pe as any).screenshotPath = screenshotPath;
  (pe as any).sessionId = sessionId;
  return pe;
}

export async function runPortal(svc: SupabaseClient, source: { id: string; config: any }, runId: string | null, mode: PortalMode, periods: string[]): Promise<PortalResult> {
  const cat = await catalogFor(svc, source.config);
  const mod = MODULES[cat.slug];
  const creds = await decryptCredential(svc, source.id, runId);
  if (!creds || cat.fields.some((f) => !creds[f])) throw new PortalError("CREDENTIAL_MISSING", "Login mangler eller er ufuldstændigt");

  const { data: cred } = await svc.from("invoiceflow_credentials").select("id, browser_context_id").eq("source_id", source.id).single();
  let contextId = cred!.browser_context_id as string | null;
  if (!contextId) {
    contextId = await createContext();
    await svc.from("invoiceflow_credentials").update({ browser_context_id: contextId }).eq("id", cred!.id);
  }

  let screenshotPath: string | null = null;
  const session = await createSession(contextId);
  let keepOpen = false;
  let browser: any = null;
  try {
    browser = await chromium.connectOverCDP(session.connectUrl);
    const ctx = browser.contexts()[0];
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    const shot = shooter(svc, source.id, runId, page, (p) => { screenshotPath = p; });
    const state = await mod.login(page, creds, shot);
    if (state === "code") { keepOpen = true; return { status: "awaiting_code", sessionId: session.id, region: session.region }; }
    const invoices = await mod.afterLogin(page, mode, periods, shot);
    return { status: "done", invoices, sessionId: session.id, region: session.region };
  } catch (e) {
    throw wrap(e, screenshotPath, session.id);
  } finally {
    await browser?.close().catch(() => {}); // afbryder kun forbindelsen; keepAlive-sessionen lever videre
    if (!keepOpen) await releaseSession(session.id);
  }
}

/**
 * Genforbinder til en session, der venter på engangskode, og poller hvert 3. sek. inden for budgetMs.
 * "still_waiting" = budget brugt; sessionen holdes åben til næste opfølgning.
 */
export async function resumePortal(
  svc: SupabaseClient, source: { id: string; config: any }, runId: string, sessionId: string,
  startedAtMs: number, mode: PortalMode, periods: string[], budgetMs: number,
): Promise<{ status: "done"; invoices: PortalInvoice[] } | { status: "still_waiting" }> {
  const cat = await catalogFor(svc, source.config);
  const mod = MODULES[cat.slug];
  let screenshotPath: string | null = null;
  let release = true;
  let browser: any = null;
  try {
    browser = await chromium.connectOverCDP(await sessionConnectUrl(sessionId));
    const ctx = browser.contexts()[0];
    const page = ctx.pages()[0];
    if (!page) throw new PortalError("PORTAL_CODE_TIMEOUT", "Browsersiden findes ikke længere");
    const shot = shooter(svc, source.id, runId, page, (p) => { screenshotPath = p; });
    const d = await waitForLogin(() => mod.probe(page), { startedAtMs, budgetMs });
    if (d === "timeout") throw new PortalError("PORTAL_CODE_TIMEOUT", "Der blev ikke tastet en kode inden 15 minutter");
    if (d === "still_waiting") { release = false; return { status: "still_waiting" }; }
    const invoices = await mod.afterLogin(page, mode, periods, shot, true);
    return { status: "done", invoices };
  } catch (e) {
    throw wrap(e, screenshotPath, sessionId);
  } finally {
    await browser?.close().catch(() => {});
    if (release) await releaseSession(sessionId);
  }
}
