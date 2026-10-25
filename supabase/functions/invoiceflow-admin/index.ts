// Ejer-handlinger: genkør, godkend og send, signeret PDF-link, test nu.
import { z } from "npm:zod@3.23.8";
import { cors, json, requireInvoiceflowOwner, deliverInvoice } from "../_shared/invoiceflow.ts";
import { runJob, previousPeriod } from "../_shared/invoiceflowWorker.ts";
import { runPortal } from "../_shared/invoiceflowPortal.ts";
import { PortalError } from "../_shared/invoiceflowPortalPeriods.ts";
import { findMailInvoices, MailRule, MailRuleError } from "../_shared/invoiceflowMailRule.ts";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rerun"), job_id: z.string().uuid() }),
  z.object({ action: z.literal("run_now"), source_id: z.string().uuid() }),
  z.object({ action: z.literal("approve_send"), invoice_id: z.string().uuid() }),
  z.object({ action: z.literal("signed_url"), invoice_id: z.string().uuid() }),
  z.object({ action: z.literal("test"), source_id: z.string().uuid() }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ctx = await requireInvoiceflowOwner(req);
  if (!ctx) return json(403, { error: "Ingen adgang" });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "Ugyldigt input" });
  const b = parsed.data;
  const { svc } = ctx;

  switch (b.action) {
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
        // Testen logges som kørsel, så dekrypteringen altid har et run_id
        const { data: tj } = await svc.from("invoiceflow_jobs").insert({ source_id: b.source_id, kind: "manual", period: "test", status: "koerer" }).select("id").single();
        const { data: tr } = await svc.from("invoiceflow_runs").insert({ job_id: tj!.id }).select("id").single();
        const done = (status: string, patch: Record<string, unknown>) => Promise.all([
          svc.from("invoiceflow_jobs").update({ status, updated_at: new Date().toISOString() }).eq("id", tj!.id),
          svc.from("invoiceflow_runs").update({ finished_at: new Date().toISOString(), result: status, ...patch }).eq("id", tr!.id),
        ]);
        try {
          const r = await runPortal(svc, { id: b.source_id, config: src.config }, tr!.id, "test", []);
          await done("ok", { invoices_found: 0 });
          return json(200, { ok: true, message: `Login ok – fakturasiden kunne nås (Browserbase-region ${r.region})` });
        } catch (e) {
          const code = e instanceof PortalError ? e.code : "UNKNOWN";
          const msg = e instanceof PortalError ? e.message : "Uventet fejl";
          // deno-lint-ignore no-explicit-any
          await done(code === "PORTAL_REQUIRES_CODE" ? "afventer_kode" : "fejlet", { error_code: code, error_message: msg, screenshot_path: (e as any)?.screenshotPath ?? null });
          return json(200, { ok: false, code, message: `${msg} (${code})` });
        }
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
