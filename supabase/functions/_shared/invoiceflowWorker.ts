// Udfører ét InvoiceFlow-job. Fase 1: kun mail-regel-kilder.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deliverInvoice, nextAttempt, notifyOwner, sha256Hex } from "./invoiceflow.ts";
import { findMailInvoices, MailRule, MailRuleError } from "./invoiceflowMailRule.ts";
import { runPortal, resumePortal } from "./invoiceflowPortal.ts";
import { PortalError, portalPeriods } from "./invoiceflowPortalPeriods.ts";
import { CODE_WAIT_TIMEOUT_MS } from "./invoiceflowCodeWait.ts";
import type { PortalInvoice, PortalMode } from "./portals/hiper.ts";

export const MAX_PARALLEL = 3;

export function previousPeriod(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// deno-lint-ignore no-explicit-any
type Job = { id: string; attempt: number; period: string | null; kind: string; source: any };

export async function claimDueJobs(svc: SupabaseClient, limit = MAX_PARALLEL): Promise<string[]> {
  const { count } = await svc.from("invoiceflow_jobs").select("id", { count: "exact", head: true }).eq("status", "koerer");
  const free = Math.max(0, limit - (count ?? 0));
  if (!free) return [];
  const now = new Date().toISOString();
  const { data } = await svc.from("invoiceflow_jobs").select("id")
    .eq("status", "ventende").lte("scheduled_at", now)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order("scheduled_at").limit(free);
  const claimed: string[] = [];
  for (const j of data ?? []) {
    const { data: upd } = await svc.from("invoiceflow_jobs").update({ status: "koerer", updated_at: now })
      .eq("id", j.id).eq("status", "ventende").select("id");
    if (upd?.length) claimed.push(j.id);
  }
  return claimed;
}

export async function runJob(svc: SupabaseClient, jobId: string, opts: { dryRun?: boolean } = {}) {
  const { data: job } = await svc.from("invoiceflow_jobs")
    .select("id, attempt, period, kind, source:invoiceflow_sources(id, type, config, owner_employee_id, requires_approval, is_paused, supplier:invoiceflow_suppliers(id, name, is_active))")
    .eq("id", jobId).single() as { data: Job | null };
  if (!job) return { ok: false, error: "Job findes ikke" };
  const attempt = job.attempt + 1;
  const { data: run } = await svc.from("invoiceflow_runs").insert({ job_id: job.id }).select("id").single();
  const runId = run!.id as string;
  const finish = (patch: Record<string, unknown>) =>
    svc.from("invoiceflow_runs").update({ finished_at: new Date().toISOString(), ...patch }).eq("id", runId);

  // Offboarding: ejerens medarbejderkort skal være aktivt
  if (job.source.owner_employee_id) {
    const { data: emp } = await svc.from("employee_master_data").select("is_active").eq("id", job.source.owner_employee_id).maybeSingle();
    if (!emp?.is_active) {
      await svc.from("invoiceflow_sources").update({ is_paused: true, pause_reason: "Ejerens medarbejderkort er deaktiveret" }).eq("id", job.source.id);
      await svc.from("invoiceflow_jobs").update({ status: "pauset", attempt, updated_at: new Date().toISOString() }).eq("id", job.id);
      await finish({ result: "pauset", error_code: "OWNER_INACTIVE", error_message: "Ejeren er deaktiveret" });
      return { ok: false, error: "OWNER_INACTIVE" };
    }
  }

  if (job.source.type === "portal") return runPortalJob(svc, job, attempt, runId, finish, opts);

  if (job.source.type !== "email") {
    await svc.from("invoiceflow_jobs").update({ status: "pauset", attempt }).eq("id", job.id);
    await finish({ result: "pauset", error_code: "NOT_SUPPORTED", error_message: "Kildetypen understøttes ikke" });
    return { ok: false, error: "NOT_SUPPORTED" };
  }

  try {
    const matches = await findMailInvoices(job.source.config as MailRule);
    let saved = 0;
    const { data: settings } = await svc.from("invoiceflow_settings").select("retention_years").eq("id", true).single();
    for (const m of matches) {
      for (const a of m.attachments) {
        const hash = await sha256Hex(a.bytes);
        const { data: dup } = await svc.from("invoiceflow_invoices").select("id").eq("pdf_hash", hash).maybeSingle();
        if (dup || opts.dryRun) { if (!dup) saved++; continue; }
        const path = `${job.source.supplier.id}/${hash}.pdf`;
        const up = await svc.storage.from("invoiceflow-pdf").upload(path, a.bytes, { contentType: "application/pdf", upsert: false });
        if (up.error && !String(up.error.message).includes("exists")) throw new MailRuleError("STORAGE", "PDF kunne ikke gemmes", true);
        const invDate = m.receivedAt.slice(0, 10);
        const ret = new Date(invDate); ret.setUTCFullYear(ret.getUTCFullYear() + (settings?.retention_years ?? 5));
        const { data: inv, error } = await svc.from("invoiceflow_invoices").insert({
          supplier_id: job.source.supplier.id, source_id: job.source.id, run_id: runId,
          invoice_date: invDate, period: job.period, pdf_path: path, pdf_hash: hash,
          fetched_by: "InvoiceFlow mail-regel", retention_until: ret.toISOString().slice(0, 10),
          status: job.source.requires_approval ? "afventer_godkendelse" : "klar",
        }).select("id").single();
        if (error) continue; // dublet via unikt indeks
        saved++;
        if (!job.source.requires_approval) await deliverInvoice(svc, inv.id);
      }
    }
    await svc.from("invoiceflow_jobs").update({ status: "ok", attempt, next_attempt_at: null, updated_at: new Date().toISOString() }).eq("id", job.id);
    await finish({ result: "ok", invoices_found: saved });
    return { ok: true, found: saved };
  } catch (e) {
    const err = e instanceof MailRuleError ? e : new MailRuleError("UNKNOWN", "Uventet fejl", true);
    const next = err.retryable ? nextAttempt(attempt) : null;
    const status = !err.retryable ? "pauset" : next ? "ventende" : "fejlet";
    await svc.from("invoiceflow_jobs").update({ status, attempt, next_attempt_at: next?.toISOString() ?? null, updated_at: new Date().toISOString() }).eq("id", job.id);
    await finish({ result: status, error_code: err.code, error_message: err.message });
    if (status !== "ventende") {
      await notifyOwner(svc, job.source.owner_employee_id, `InvoiceFlow: ${job.source.supplier.name} ${status}`,
        `Hentningen for ${job.source.supplier.name} er ${status}. Årsag: ${err.message}.`);
    }
    return { ok: false, error: err.code };
  }
}

// ---------- Portal-kilder (trin 2) ----------
type Finish = (p: Record<string, unknown>) => PromiseLike<unknown>;
const nowIso = () => new Date().toISOString();

export function portalMode(job: { kind: string; period: string | null }): PortalMode {
  if (job.kind === "keepalive") return "keepalive";
  if (job.period === "test") return "test";
  return "fetch";
}

async function portalPeriodsFor(svc: SupabaseClient, job: Job) {
  if (portalMode(job) !== "fetch") return [];
  const { count: prior } = await svc.from("invoiceflow_invoices").select("id", { count: "exact", head: true }).eq("source_id", job.source.id);
  return portalPeriods(job.period ?? previousPeriod(), !prior);
}

/** Starter en kode-opfølgning i baggrunden (kæde af korte kørsler, kun mens der ventes). */
export function kickCodeWait() {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/invoiceflow-cron`;
  const p = fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` }, body: JSON.stringify({ task: "code_wait" }) }).catch(() => {});
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil?.(p);
}

async function runPortalJob(svc: SupabaseClient, job: Job, attempt: number, runId: string, finish: Finish, opts: { dryRun?: boolean }) {
  try {
    const periods = await portalPeriodsFor(svc, job);
    const r = await runPortal(svc, job.source, runId, portalMode(job), periods);
    await svc.from("invoiceflow_runs").update({ browserbase_session_id: r.sessionId }).eq("id", runId);
    if (r.status === "awaiting_code") {
      await svc.from("invoiceflow_runs").update({ live_view_expires_at: new Date(Date.now() + CODE_WAIT_TIMEOUT_MS).toISOString() }).eq("id", runId);
      await svc.from("invoiceflow_jobs").update({ status: "afventer_kode", attempt, next_attempt_at: null, updated_at: nowIso() }).eq("id", job.id);
      await notifyOwner(svc, job.source.owner_employee_id, `InvoiceFlow: ${job.source.supplier.name} beder om en engangskode`,
        `${job.source.supplier.name} beder om en engangskode – åbn kørslen i Stork.`);
      kickCodeWait();
      return { ok: false, error: "AWAITING_CODE" };
    }
    return await completePortalJob(svc, job, attempt, runId, finish, r.invoices, opts);
  } catch (e) {
    return await failPortalJob(svc, job, attempt, finish, e);
  }
}

/** Opfølgning på et job i afventer_kode. budgetMs holder kørslen under edge-grænsen. */
export async function resumeCodeJob(svc: SupabaseClient, jobId: string, budgetMs: number) {
  const { data: job } = await svc.from("invoiceflow_jobs")
    .select("id, attempt, period, kind, status, source:invoiceflow_sources(id, type, config, owner_employee_id, requires_approval, is_paused, supplier:invoiceflow_suppliers(id, name, is_active))")
    .eq("id", jobId).single() as { data: (Job & { status: string }) | null };
  if (!job || job.status !== "afventer_kode") return { status: "not_waiting" as const };
  const { data: run } = await svc.from("invoiceflow_runs").select("id, browserbase_session_id, live_view_expires_at")
    .eq("job_id", jobId).not("browserbase_session_id", "is", null).order("started_at", { ascending: false }).limit(1).maybeSingle();
  const runId = run?.id ?? null;
  const finish: Finish = (patch) => runId
    ? svc.from("invoiceflow_runs").update({ finished_at: nowIso(), live_view_expires_at: null, ...patch }).eq("id", runId)
    : Promise.resolve(null);
  if (!run?.browserbase_session_id || !run.live_view_expires_at) {
    await failPortalJob(svc, job, job.attempt, finish, new PortalError("PORTAL_CODE_TIMEOUT", "Ventende session mangler"));
    return { status: "timeout" as const };
  }
  const startedAtMs = new Date(run.live_view_expires_at).getTime() - CODE_WAIT_TIMEOUT_MS;
  try {
    const periods = await portalPeriodsFor(svc, job);
    const r = await resumePortal(svc, job.source, run.id, run.browserbase_session_id, startedAtMs, portalMode(job), periods, budgetMs);
    if (r.status === "still_waiting") return { status: "waiting" as const };
    await svc.from("invoiceflow_jobs").update({ status: "koerer", updated_at: nowIso() }).eq("id", job.id);
    await completePortalJob(svc, job, job.attempt, run.id, finish, r.invoices, {});
    return { status: "done" as const };
  } catch (e) {
    await failPortalJob(svc, job, job.attempt, finish, e);
    return { status: "failed" as const };
  }
}

async function completePortalJob(svc: SupabaseClient, job: Job, attempt: number, runId: string, finish: Finish, invoices: PortalInvoice[], opts: { dryRun?: boolean }) {
  const { data: settings } = await svc.from("invoiceflow_settings").select("retention_years").eq("id", true).single();
  let saved = 0;
  for (const p of invoices) {
    const hash = await sha256Hex(p.bytes);
    const { data: dup } = await svc.from("invoiceflow_invoices").select("id").eq("pdf_hash", hash).maybeSingle();
    if (dup || opts.dryRun) { if (!dup) saved++; continue; }
    const path = `${job.source.supplier.id}/${hash}.pdf`;
    const up = await svc.storage.from("invoiceflow-pdf").upload(path, p.bytes, { contentType: "application/pdf", upsert: false });
    if (up.error && !String(up.error.message).includes("exists")) throw new PortalError("BROWSERBASE", "PDF kunne ikke gemmes", true);
    const base = p.invoiceDate ?? nowIso().slice(0, 10);
    const ret = new Date(base); ret.setUTCFullYear(ret.getUTCFullYear() + (settings?.retention_years ?? 5));
    const { data: inv, error } = await svc.from("invoiceflow_invoices").insert({
      supplier_id: job.source.supplier.id, source_id: job.source.id, run_id: runId,
      invoice_number: p.invoiceNumber, invoice_date: p.invoiceDate, amount_incl_vat: p.amountInclVat,
      period: p.invoiceDate ? p.invoiceDate.slice(0, 7) : job.period, pdf_path: path, pdf_hash: hash,
      fetched_by: "InvoiceFlow portal (Hiper)", retention_until: ret.toISOString().slice(0, 10),
      status: job.source.requires_approval ? "afventer_godkendelse" : "klar",
    }).select("id").single();
    if (error) continue;
    saved++;
    if (!job.source.requires_approval) await deliverInvoice(svc, inv.id);
  }
  await svc.from("invoiceflow_jobs").update({ status: "ok", attempt, next_attempt_at: null, updated_at: nowIso() }).eq("id", job.id);
  await finish({ result: "ok", invoices_found: saved, live_view_expires_at: null });
  return { ok: true, found: saved };
}

async function failPortalJob(svc: SupabaseClient, job: Job, attempt: number, finish: Finish, e: unknown) {
  const err = e instanceof PortalError ? e : new PortalError("PORTAL_LAYOUT", "Uventet fejl");
  // deno-lint-ignore no-explicit-any
  const extra = e as any;
  const next = err.retryable ? nextAttempt(attempt) : null;
  const status = !err.retryable ? "pauset" : next ? "ventende" : "fejlet";
  await svc.from("invoiceflow_jobs").update({ status, attempt, next_attempt_at: next?.toISOString() ?? null, updated_at: nowIso() }).eq("id", job.id);
  const patch: Record<string, unknown> = { result: status, error_code: err.code, error_message: err.message, screenshot_path: extra?.screenshotPath ?? null, live_view_expires_at: null };
  if (extra?.sessionId) patch.browserbase_session_id = extra.sessionId;
  await finish(patch);
  if (status !== "ventende") {
    const text = err.code === "PORTAL_CODE_TIMEOUT"
      ? `${job.source.supplier.name} bad om en engangskode, men der blev ikke tastet en kode inden 15 minutter. Jobbet er pauset.`
      : `Hentningen for ${job.source.supplier.name} er ${status}. Årsag: ${err.message} (${err.code}).`;
    await notifyOwner(svc, job.source.owner_employee_id, `InvoiceFlow: ${job.source.supplier.name} ${status}`, text);
  }
  return { ok: false, error: err.code };
}
