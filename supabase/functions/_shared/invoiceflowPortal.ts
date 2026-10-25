// Kører et portal-flow i Browserbase. Logins dekrypteres kun her og forlader aldrig funktionen.
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chromium } from "npm:playwright-core@1.48.2";
import { decryptCredential } from "./invoiceflow.ts";
import { createContext, createSession, releaseSession } from "./browserbase.ts";
import { PortalError, resolveCatalog } from "./invoiceflowPortalPeriods.ts";
import { runHiper, PortalInvoice } from "./portals/hiper.ts";

const MODULES = { hiper: runHiper } as const;

export async function runPortal(
  svc: SupabaseClient,
  source: { id: string; config: any },
  runId: string | null,
  mode: "test" | "keepalive" | "fetch",
  periods: string[],
): Promise<{ invoices: PortalInvoice[]; screenshotPath: string | null; region: string | null }> {
  const { data: entry } = await svc.from("invoiceflow_portal_catalog").select("slug, status, flow_version, login_fields")
    .eq("slug", source.config?.catalog_slug ?? "").maybeSingle();
  const cat = resolveCatalog(entry);

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
  let browser: any = null;
  try {
    browser = await chromium.connectOverCDP(session.connectUrl);
    const ctx = browser.contexts()[0];
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    const shot = async (name: string) => {
      try {
        // Felter tømmes før screenshot, så login aldrig optræder i billedet
        await page.evaluate(() => document.querySelectorAll("input").forEach((i: any) => { i.value = ""; })).catch(() => {});
        const png = await page.screenshot({ type: "png" });
        const path = `${source.id}/${runId ?? "test"}-${name}.png`;
        await svc.storage.from("invoiceflow-debug").upload(path, png, { contentType: "image/png", upsert: true });
        screenshotPath = path;
      } catch { /* screenshot må ikke vælte fejlhåndteringen */ }
    };
    const invoices = await MODULES[cat.slug](page, creds, mode, periods, shot);
    return { invoices, screenshotPath, region: session.region };
  } catch (e) {
    if (e instanceof PortalError) { (e as any).screenshotPath = screenshotPath; throw e; }
    const pe = new PortalError("PORTAL_LAYOUT", "Uventet fejl i portal-flowet");
    (pe as any).screenshotPath = screenshotPath;
    throw pe;
  } finally {
    await browser?.close().catch(() => {});
    await releaseSession(session.id);
  }
}
