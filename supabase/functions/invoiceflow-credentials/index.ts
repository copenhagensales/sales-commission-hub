// Write-only vault: gem/overskriv/slet login. Returnerer aldrig klartekst.
import { z } from "npm:zod@3.23.8";
import { cors, json, requireInvoiceflowOwner, encryptPayload } from "../_shared/invoiceflow.ts";

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    source_id: z.string().uuid(),
    fields: z.record(z.string().min(1).max(50), z.string().min(1).max(4000)).refine((f) => Object.keys(f).length > 0 && Object.keys(f).length <= 10),
  }),
  z.object({ action: z.literal("delete"), source_id: z.string().uuid() }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ctx = await requireInvoiceflowOwner(req);
  if (!ctx) return json(403, { error: "Ingen adgang" });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "Ugyldigt input" });
  const b = parsed.data;
  const { svc, userId } = ctx;

  const { data: existing } = await svc.from("invoiceflow_credentials").select("id, owner_user_id").eq("source_id", b.source_id).maybeSingle();
  if (existing && existing.owner_user_id !== userId) return json(403, { error: "Kun ejeren af loginnet kan ændre det" });

  if (b.action === "delete") {
    if (existing) await svc.from("invoiceflow_credentials").delete().eq("id", existing.id);
    return json(200, { ok: true });
  }

  const { data: src } = await svc.from("invoiceflow_sources").select("id").eq("id", b.source_id).maybeSingle();
  if (!src) return json(404, { error: "Kilde findes ikke" });
  const enc = await encryptPayload(b.fields);
  const row = { source_id: b.source_id, owner_user_id: userId, ...enc, field_names: Object.keys(b.fields), updated_at: new Date().toISOString() };
  const { error } = existing
    ? await svc.from("invoiceflow_credentials").update(row).eq("id", existing.id)
    : await svc.from("invoiceflow_credentials").insert(row);
  if (error) return json(500, { error: "Login kunne ikke gemmes" });
  return json(200, { ok: true, updated_at: row.updated_at });
});
