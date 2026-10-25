// Dagligt cron-kald + worker. Opretter jobs på kørselsdage, kører køen og laver kontroller.
import { cors, json, isCron, serviceClient, notifyOwner } from "../_shared/invoiceflow.ts";
import { claimDueJobs, previousPeriod, runJob } from "../_shared/invoiceflowWorker.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
async function activeSources(svc: SupabaseClient): Promise<any[]> {
  const { data } = await svc.from("invoiceflow_sources")
    .select("id, owner_employee_id, supplier_id, supplier:invoiceflow_suppliers!inner(id, name, is_active, cadence)")
    .eq("is_paused", false).eq("supplier.is_active", true);
  return data ?? [];
}

async function createJobs(svc: SupabaseClient, kind: "fetch" | "catchup", period: string) {
  let n = 0;
  for (const s of await activeSources(svc)) {
    if (kind === "catchup") {
      const { count } = await svc.from("invoiceflow_invoices").select("id", { count: "exact", head: true }).eq("supplier_id", s.supplier_id).eq("period", period);
      if (count) continue;
    }
    const { count: exists } = await svc.from("invoiceflow_jobs").select("id", { count: "exact", head: true })
      .eq("source_id", s.id).eq("period", period).eq("kind", kind);
    if (exists) continue;
    await svc.from("invoiceflow_jobs").insert({ source_id: s.id, kind, period });
    n++;
  }
  return n;
}

async function createKeepalive(svc: SupabaseClient, now: Date) {
  const { data } = await svc.from("invoiceflow_sources").select("id, supplier:invoiceflow_suppliers!inner(is_active)")
    .eq("type", "portal").eq("is_paused", false).eq("supplier.is_active", true);
  const week = now.toISOString().slice(0, 10);
  let n = 0;
  for (const s of data ?? []) {
    const { count } = await svc.from("invoiceflow_jobs").select("id", { count: "exact", head: true })
      .eq("source_id", s.id).eq("kind", "keepalive").eq("period", week);
    if (count) continue;
    await svc.from("invoiceflow_jobs").insert({ source_id: s.id, kind: "keepalive", period: week });
    n++;
  }
  return n;
}

/** Forventningskontrol: mangler en forventet faktura i perioden? */
export function periodsToCheck(cadence: string, now: Date): string[] | null {
  if (cadence === "irregular") return null;
  const months = cadence === "quarterly" ? 3 : 1;
  const out: string[] = [];
  for (let i = 1; i <= months; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

async function expectationCheck(svc: SupabaseClient, now: Date) {
  const { data: sups } = await svc.from("invoiceflow_suppliers").select("id, name, cadence").eq("is_active", true);
  let missing = 0;
  for (const s of sups ?? []) {
    const periods = periodsToCheck(s.cadence, now);
    if (!periods) { await svc.from("invoiceflow_suppliers").update({ missing_period: null, missing_checked_at: now.toISOString() }).eq("id", s.id); continue; }
    const { count } = await svc.from("invoiceflow_invoices").select("id", { count: "exact", head: true }).eq("supplier_id", s.id).in("period", periods);
    const miss = count ? null : periods[0];
    await svc.from("invoiceflow_suppliers").update({ missing_period: miss, missing_checked_at: now.toISOString() }).eq("id", s.id);
    if (miss) {
      missing++;
      const { data: src } = await svc.from("invoiceflow_sources").select("owner_employee_id").eq("supplier_id", s.id).limit(1).maybeSingle();
      await notifyOwner(svc, src?.owner_employee_id ?? null, `InvoiceFlow: faktura mangler fra ${s.name}`,
        `Der er ikke hentet en forventet faktura fra ${s.name} for perioden ${miss}.`);
    }
  }
  return missing;
}

/** Compliance: dekrypteringer uden tilhørende kørsel (seneste døgn). */
async function credentialUseCheck(svc: SupabaseClient) {
  const since = new Date(Date.now() - 26 * 3600_000).toISOString();
  const { count } = await svc.from("invoiceflow_credential_use_log").select("id", { count: "exact", head: true })
    .is("run_id", null).gte("used_at", since);
  await svc.rpc("compliance_raise", {
    p_key: "invoiceflow_decrypt_without_run", p_sev: "KRITISK",
    p_title: "InvoiceFlow-login dekrypteret uden kørsel", p_val: count ?? 0, p_thr: 0,
    p_detail: { timer: 26 },
  }).then(() => {}, () => {});
  return count ?? 0;
}

async function work(svc: SupabaseClient) {
  const ids = await claimDueJobs(svc);
  const results = await Promise.all(ids.map((id) => runJob(svc, id)));
  return { koert: ids.length, ok: results.filter((r) => r.ok).length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!(await isCron(req))) return json(401, { error: "Unauthorized" });
  const svc = serviceClient();
  const body = await req.json().catch(() => ({}));
  const now = new Date();
  const out: Record<string, unknown> = {};

  // Kaldes hver time; daglige opgaver kun i timen kl. 06 dansk tid.
  const cphHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", hour: "2-digit", hour12: false }).format(now));
  if (body.task === "daily" || (body.task !== "work" && cphHour === 6)) {
    const { data: st } = await svc.from("invoiceflow_settings").select("run_day, catchup_day, expectation_day").eq("id", true).single();
    const day = now.getUTCDate();
    const period = previousPeriod(now);
    if (day === st?.run_day) out.oprettet = await createJobs(svc, "fetch", period);
    if (day === st?.catchup_day) out.opsamling = await createJobs(svc, "catchup", period);
    if (day === st?.expectation_day) out.mangler = await expectationCheck(svc, now);
    // Ugentlig hold-i-live (mandag) for aktive portal-kilder
    const cphDow = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", weekday: "short" }).format(now);
    if (cphDow === "Mon" || body.task === "keepalive") out.keepalive = await createKeepalive(svc, now);
    out.dekryptering_uden_koersel = await credentialUseCheck(svc);
  }
  out.work = await work(svc);
  return json(200, out);
});
