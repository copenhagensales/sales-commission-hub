// Ejer-handlinger: genkør, godkend og send, signeret PDF-link, test nu.
import { z } from "npm:zod@3.23.8";
import { cors, json, requireInvoiceflowOwner, deliverInvoice } from "../_shared/invoiceflow.ts";
import { runJob, previousPeriod, resumeCodeJob } from "../_shared/invoiceflowWorker.ts";
import { liveViewUrl } from "../_shared/browserbase.ts";
import { PortalError } from "../_shared/invoiceflowPortalPeriods.ts";
import { findMailInvoices, MailRule, MailRuleError } from "../_shared/invoiceflowMailRule.ts";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rerun"), job_id: z.string().uuid() }),
  z.object({ action: z.literal("run_now"), source_id: z.string().uuid() }),
  z.object({ action: z.literal("approve_send"), invoice_id: z.string().uuid() }),
  z.object({ action: z.literal("signed_url"), invoice_id: z.string().uuid() }),
  z.object({ action: z.literal("test"), source_id: z.string().uuid() }),
  z.object({ action: z.literal("live_view"), job_id: z.string().uuid() }),
  z.object({ action: z.literal("check_code"), job_id: z.string().uuid() }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ctx = await requireInvoiceflowOwner(req);
  if (!ctx) return json(403, { error: "Ingen adgang" });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "Ugyldigt input" });
  const b = parsed.data;
  const { svc } = ctx;

  /** Live View kun for den bruger, der ejer loginnet på kilden, og kun mens jobbet venter på kode. */
  async function codeJobForOwner(jobId: string) {
    const { data: job } = await svc.from("invoiceflow_jobs").select("id, status, source_id").eq("id", jobId).maybeSingle();
    if (!job || job.status !== "afventer_kode") return null;
    const { data: cred } = await svc.from("invoiceflow_credentials").select("owner_user_id").eq("source_id", job.source_id).maybeSingle();
    if (!cred || cred.owner_user_id !== ctx!.userId) return null;
    const { data: run } = await svc.from("invoiceflow_runs").select("browserbase_session_id, live_view_expires_at")
      .eq("job_id", jobId).not("browserbase_session_id", "is", null).order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (!run?.browserbase_session_id || !run.live_view_expires_at || new Date(run.live_view_expires_at) <= new Date()) return null;
    return run;
  }

  switch (b.action) {
    case "live_view": {
      const run = await codeJobForOwner(b.job_id);
      if (!run) return json(403, { error: "Live View er ikke tilgængelig" });
      try {
        const url = await liveViewUrl(run.browserbase_session_id!);
        return new Response(JSON.stringify({ url, expires_at: run.live_view_expires_at }), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
      } catch {
        return json(502, { error: "Live View kunne ikke hentes" });
      }
    }
    case "check_code": {
      const run = await codeJobForOwner(b.job_id);
      if (!run) return json(403, { error: "Jobbet venter ikke på kode" });
      const r = await resumeCodeJob(svc, b.job_id, 8_000);
      return json(200, { ok: r.status === "done", status: r.status });
    }
    case "rerun": {
      const { data } = await svc.from("invoiceflow_jobs").update({ status: "koerer", next_attempt_at: null, attempt: 0 })
        .eq("id", b.job_id).neq("status", "koerer").select("id");
      if (!data?.length) return json(409, { error: "Jobbet kører allerede eller findes ikke" });
      return json(200, await runJob(svc, b.job_id));
    }
    case "run_now": {
      const { data: job, error } = await svc.from("invoiceflow_jobs")
        .insert({ source_id: b.source_id, kind: "manual", period: previousPeriod(), status: "koerer" }).select("id").single();
      if (error) return json(500, { error: "Job kunne ikke oprettes" });
      return json(200, await runJob(svc, job.id));
    }
    case "approve_send": {
      await svc.from("invoiceflow_invoices").update({ status: "klar" }).eq("id", b.invoice_id).eq("status", "afventer_godkendelse");
      const r = await deliverInvoice(svc, b.invoice_id);
      return json(r.ok ? 200 : 422, r);
    }
    case "signed_url": {
      const { data: inv } = await svc.from("invoiceflow_invoices").select("pdf_path").eq("id", b.invoice_id).maybeSingle();
      if (!inv) return json(404, { error: "Faktura findes ikke" });
      const { data } = await svc.storage.from("invoiceflow-pdf").createSignedUrl(inv.pdf_path, 300);
      return json(200, { url: data?.signedUrl });
    }
    case "test": {
      const { data: src } = await svc.from("invoiceflow_sources").select("type, config").eq("id", b.source_id).maybeSingle();
      if (!src) return json(404, { error: "Kilde findes ikke" });
      if (src.type === "portal") {
        // Test = login → fakturaside → log ud. Køres som job (period "test"), så dekryptering altid har et run_id,
        // og en engangskode håndteres via Live View som ved almindelige kørsler.
        const { data: tj, error } = await svc.from("invoiceflow_jobs").insert({ source_id: b.source_id, kind: "manual", period: "test", status: "koerer" }).select("id").single();
        if (error) return json(500, { error: "Test kunne ikke startes" });
        const r = await runJob(svc, tj.id);
        if (r.ok) return json(200, { ok: true, message: "Login ok – fakturasiden kunne nås" });
        if (r.error === "AWAITING_CODE") return json(200, { ok: false, code: "AWAITING_CODE", job_id: tj.id, message: "Portalen beder om en engangskode – åbn kørslen under Kørsler" });
        return json(200, { ok: false, code: r.error, message: `Test fejlede (${r.error})` });
      }
      if (src.type !== "email") return json(200, { ok: false, message: "Kildetypen kan ikke testes" });
      try {
        const m = await findMailInvoices(src.config as MailRule);
        const pdfs = m.reduce((n, x) => n + x.attachments.length, 0);
        return json(200, { ok: true, message: `Forbindelse ok – ${m.length} mails og ${pdfs} PDF'er matcher reglen` });
      } catch (e) {
        return json(200, { ok: false, message: e instanceof MailRuleError ? e.message : "Uventet fejl" });
      }
    }
  }
});
