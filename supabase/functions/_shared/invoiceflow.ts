// InvoiceFlow: fælles hjælpere. Credentials må aldrig logges eller returneres.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendM365Mail, toBase64 } from "./m365-mail.ts";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Kræver indlogget bruger med InvoiceFlow-scope 'owner' i invoiceflow_access. */
export async function requireInvoiceflowOwner(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const svc = serviceClient();
  const { data } = await svc.auth.getUser(auth.slice(7));
  if (!data?.user) return null;
  const { data: row } = await svc.from("invoiceflow_access").select("id")
    .eq("user_id", data.user.id).eq("scope", "owner").maybeSingle();
  if (!row) return null;
  return { userId: data.user.id, svc };
}

/** Cron-kald: x-cron-secret valideret via eksisterende verify_internal_cron_secret. */
export async function isCron(req: Request) {
  const s = req.headers.get("x-cron-secret");
  if (!s) return false;
  const { data } = await serviceClient().rpc("verify_internal_cron_secret", { _token: s });
  return data === true;
}

// ---------- Vault (AES-GCM, nøgle kun i INVOICEFLOW_VAULT_KEY) ----------
async function vaultKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("INVOICEFLOW_VAULT_KEY");
  if (!raw) throw new Error("VAULT_KEY_MISSING");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (u: Uint8Array) => toBase64(u);
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encryptPayload(payload: Record<string, string>) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await vaultKey(),
    new TextEncoder().encode(JSON.stringify(payload)));
  return { ciphertext: b64(new Uint8Array(ct)), iv: b64(iv) };
}

/** Kun til brug inde i en kørsel. Logger brugen med run_id. */
export async function decryptCredential(svc: SupabaseClient, sourceId: string, runId: string | null) {
  const { data: c } = await svc.from("invoiceflow_credentials").select("id, ciphertext, iv").eq("source_id", sourceId).maybeSingle();
  if (!c) return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(c.iv) }, await vaultKey(), unb64(c.ciphertext));
    await svc.from("invoiceflow_credential_use_log").insert({ credential_id: c.id, run_id: runId, result: "ok" });
    await svc.from("invoiceflow_credentials").update({ last_used_at: new Date().toISOString() }).eq("id", c.id);
    return JSON.parse(new TextDecoder().decode(pt)) as Record<string, string>;
  } catch {
    await svc.from("invoiceflow_credential_use_log").insert({ credential_id: c.id, run_id: runId, result: "fejl" });
    return null;
  }
}

export async function sha256Hex(bytes: Uint8Array) {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- Retry-regel ----------
export const RETRY_DELAYS_MIN = [10, 60, 360];
/** Returnerer næste forsøgstidspunkt, eller null hvis forsøgene er brugt op. */
export function nextAttempt(attempt: number, now = new Date()): Date | null {
  const d = RETRY_DELAYS_MIN[attempt - 1];
  return d === undefined ? null : new Date(now.getTime() + d * 60_000);
}

// ---------- Mail til ejer / bogholderi ----------
export async function ownerEmail(svc: SupabaseClient, employeeId: string | null) {
  if (!employeeId) return null;
  const { data } = await svc.from("employee_master_data").select("work_email").eq("id", employeeId).maybeSingle();
  return data?.work_email ?? null;
}

export async function notifyOwner(svc: SupabaseClient, employeeId: string | null, subject: string, text: string) {
  const to = await ownerEmail(svc, employeeId);
  if (!to) return;
  try {
    await sendM365Mail({ to: [to], subject, html: `<p>${escapeHtml(text)}</p>` });
  } catch { /* må ikke vælte kørslen */ }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function deliverySubject(supplier: string, invoiceNo: string | null, date: string | null) {
  return `Faktura – ${supplier} – ${invoiceNo ?? "uden nr."} – ${date ?? "uden dato"}`;
}

/** Sender én faktura til bogholderiet. Maks. 3 forsøg i alt. */
export async function deliverInvoice(svc: SupabaseClient, invoiceId: string) {
  const { data: settings } = await svc.from("invoiceflow_settings").select("bookkeeping_email").eq("id", true).single();
  const to = settings?.bookkeeping_email;
  if (!to) return { ok: false, reason: "Bogholderi-mail er ikke sat" };

  const { data: sent } = await svc.from("invoiceflow_deliveries").select("id").eq("invoice_id", invoiceId).eq("status", "sendt").limit(1);
  if (sent?.length) return { ok: true, reason: "Allerede sendt" };

  const { data: inv } = await svc.from("invoiceflow_invoices")
    .select("id, invoice_number, invoice_date, amount_incl_vat, amount_excl_vat, currency, period, pdf_path, fetched_by, supplier:invoiceflow_suppliers(name), source:invoiceflow_sources(owner_employee_id)")
    .eq("id", invoiceId).single();
  if (!inv) return { ok: false, reason: "Faktura findes ikke" };
  // deno-lint-ignore no-explicit-any
  const supplierName = (inv as any).supplier?.name ?? "Ukendt";
  const file = await svc.storage.from("invoiceflow-pdf").download(inv.pdf_path);
  if (file.error || !file.data) return { ok: false, reason: "PDF mangler" };
  const bytes = new Uint8Array(await file.data.arrayBuffer());

  const fmt = (n: number | null) => (n == null ? "–" : `${Number(n).toLocaleString("da-DK", { minimumFractionDigits: 2 })} ${inv.currency}`);
  const html = `<p>Leverandør: ${escapeHtml(supplierName)}<br>Fakturanr.: ${escapeHtml(inv.invoice_number ?? "–")}<br>
Fakturadato: ${escapeHtml(inv.invoice_date ?? "–")}<br>Beløb inkl. moms: ${fmt(inv.amount_incl_vat)}<br>
Beløb ekskl. moms: ${fmt(inv.amount_excl_vat)}<br>Periode: ${escapeHtml(inv.period ?? "–")}<br>
Hentet af: ${escapeHtml(inv.fetched_by ?? "InvoiceFlow")}</p>`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await sendM365Mail({
        to: [to],
        subject: deliverySubject(supplierName, inv.invoice_number, inv.invoice_date),
        html,
        attachments: [{ name: `${supplierName}-${inv.invoice_number ?? inv.id}.pdf`.replace(/[^\wæøåÆØÅ.\- ]/g, "_"), contentType: "application/pdf", contentBytes: b64(bytes) }],
      });
      await svc.from("invoiceflow_deliveries").insert({ invoice_id: invoiceId, recipient_email: to, sent_at: new Date().toISOString(), status: "sendt", attempt });
      await svc.from("invoiceflow_invoices").update({ status: "sendt" }).eq("id", invoiceId);
      return { ok: true };
    } catch (e) {
      await svc.from("invoiceflow_deliveries").insert({ invoice_id: invoiceId, recipient_email: to, status: "fejlet", attempt, error_message: String(e).slice(0, 300) });
    }
  }
  await svc.from("invoiceflow_invoices").update({ status: "ikke_leveret" }).eq("id", invoiceId);
  // deno-lint-ignore no-explicit-any
  await notifyOwner(svc, (inv as any).source?.owner_employee_id ?? null, "InvoiceFlow: faktura ikke leveret",
    `Fakturaen fra ${supplierName} (${inv.invoice_number ?? "uden nr."}) kunne ikke sendes til bogholderiet efter 3 forsøg.`);
  return { ok: false, reason: "Afsendelse fejlede 3 gange" };
}
