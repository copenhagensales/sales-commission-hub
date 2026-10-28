// sb-fil (S6 / 24d). Udsteder upload-token til chat-vedhæftninger og streamer filer til samtalens medlemmer.
// verify_jwt=true + egen JWT-kontrol. Ingen Storage-læse-URL forlader edge. Fejlsvar er {kode} uden indhold/filnavne.
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "chat-attachments";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAKS = 10 * 1024 * 1024;
const RATE = 60;
export const TYPER: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", txt: "text/plain" };
const EXT_FOR: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "text/plain": "txt" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Range, Content-Disposition, Content-Length, Accept-Ranges, Retry-After",
};
const json = (b: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store", ...extra } });

/** Indholdsbaseret type (magic bytes). */
export function filtype(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b.includes(0)) return null;
  try { new TextDecoder("utf-8", { fatal: true }).decode(b); return "text/plain"; } catch { return null; }
}

/** Sikker Content-Disposition: ASCII-fallback + RFC 5987; endelse tvinges til den faktiske type. */
export function disposition(navn: string | null, type: string): string {
  const ext = EXT_FOR[type];
  const stamme = (navn ?? "").replace(/\.[^.]*$/, "").replace(/[\u0000-\u001f\u007f"\\/;:\r\n]/g, "").trim().slice(0, 100) || "fil";
  const fuld = `${stamme}.${ext}`;
  const ascii = fuld.replace(/[^\x20-\x7e]/g, "_");
  const art = type.startsWith("image/") ? "inline" : "attachment";
  return `${art}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fuld)}`;
}

/** Én byte-range. null = hele filen; "ugyldig" = 416. */
export function range(h: string | null, size: number): { start: number; slut: number } | null | "ugyldig" {
  if (!h) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(h.trim());
  if (!m || (m[1] === "" && m[2] === "")) return "ugyldig";
  let start: number, slut: number;
  if (m[1] === "") { const n = Number(m[2]); if (n <= 0) return "ugyldig"; start = Math.max(0, size - n); slut = size - 1; }
  else { start = Number(m[1]); slut = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(slut) || start > slut || start >= size) return "ugyldig";
  return { start, slut };
}

/** Udløb (sek. epoch) fra Storage-upload-tokenets JWT-payload. */
export function tokenUdloeb(token: string): number | null {
  try {
    const p = token.split(".")[1];
    const o = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(p.length / 4) * 4, "=")));
    return typeof o.exp === "number" && Number.isFinite(o.exp) ? o.exp : null;
  } catch { return null; }
}

const kald = new Map<string, number[]>();
function begraens(uid: string): number {
  const nu = Date.now();
  const l = (kald.get(uid) ?? []).filter((t) => t > nu - 60_000);
  if (l.length >= RATE) { kald.set(uid, l); return Math.max(1, Math.ceil((l[0] + 60_000 - nu) / 1000)); }
  l.push(nu); kald.set(uid, l);
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const start = Date.now();
  const log = (kode: string, ekstra: Record<string, unknown> = {}) => console.log("sb-fil", { kode, ...ekstra, varighed_ms: Date.now() - start });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ kode: "jwt" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const bruger = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: u, error: uErr } = await bruger.auth.getUser(auth.slice(7));
    if (uErr || !u?.user) return json({ kode: "jwt" }, 401);
    const vent = begraens(u.user.id);
    if (vent) { log("rate"); return json({ kode: "rate" }, 429, { "Retry-After": String(vent) }); }
    const { data: emp, error: eErr } = await bruger.rpc("get_current_employee_id");
    if (eErr || typeof emp !== "string") return json({ kode: "ingen_medarbejder" }, 403);
    const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: em, error: amErr } = await svc.from("employee_master_data").select("is_active").eq("id", emp).maybeSingle();
    if (amErr) return json({ kode: "db" }, 500);
    if (em?.is_active !== true) return json({ kode: "inaktiv" }, 403);

    const action = new URL(req.url).searchParams.get("action");

    // ---------- udsted ----------
    if (req.method === "POST") {
      const b = await req.json().catch(() => null);
      if (!b || b.action !== "udsted" || typeof b.conversation_id !== "string" || !UUID.test(b.conversation_id)
        || typeof b.filnavn !== "string" || b.filnavn.length < 1 || b.filnavn.length > 200 || typeof b.type !== "string"
        || typeof b.size !== "number" || !Number.isInteger(b.size) || b.size < 1) return json({ kode: "ugyldig" }, 400);
      const ext = (/\.([a-z0-9]{1,5})$/i.exec(b.filnavn)?.[1] ?? "").toLowerCase();
      if (ext === "pdf" || b.type === "application/pdf") return json({ kode: "pdf_udskudt" }, 400);
      if (!TYPER[ext] || TYPER[ext] !== b.type) return json({ kode: "filtype" }, 400);
      if (b.size > MAKS) return json({ kode: "stoerrelse" }, 400);
      const { data: med, error: mErr } = await svc.from("chat_conversation_members").select("id")
        .eq("conversation_id", b.conversation_id).eq("employee_id", emp).maybeSingle();
      if (mErr) return json({ kode: "db" }, 500);
      if (!med) return json({ kode: "ikke_medlem" }, 403);

      const sti = `${b.conversation_id}/${emp}/${crypto.randomUUID()}.${EXT_FOR[TYPER[ext]]}`;
      // 1. Registrér stien (DB håndhæver spærring).
      const { error: iErr } = await svc.from("sb_stier").insert({
        bucket: BUCKET, sti, ejer_employee_id: emp, samtale_id: b.conversation_id, status: "uploadet", udstedt_at: new Date().toISOString(), upload_udloeb_at: null,
      });
      if (iErr) {
        const konflikt = iErr.code === "23505" || (iErr.code === "P0001" && /spærret/i.test(iErr.message ?? ""));
        log(konflikt ? "konflikt" : "register_fejl");
        return json({ kode: konflikt ? "konflikt" : "register_fejl" }, konflikt ? 409 : 500);
      }
      const opryd = async (kode: string) => {
        const a = await svc.from("sb_stier").update({ status: "slettes" }).eq("bucket", BUCKET).eq("sti", sti).eq("status", "uploadet");
        const k = await svc.rpc("sb_koe_fil", { p_bucket: BUCKET, p_sti: sti, p_kilde: "udstedelse_fejl", p_kilde_id: null });
        log(kode, { markering: a.error ? "fejl" : "ok", koe: k.error ? "fejl" : "ok" });
        return json({ kode }, 500);
      };
      // 2. Token (aldrig upsert, aldrig fornyet på samme sti).
      const { data: up, error: tErr } = await svc.storage.from(BUCKET).createSignedUploadUrl(sti, { upsert: false });
      if (tErr || !up?.token) return await opryd("token_fejl");
      // 3. Finalisér det faktiske udløb én gang, mens rækken er uploadet.
      const exp = tokenUdloeb(up.token);
      if (!exp) return await opryd("udloeb_ukendt");
      const { data: fin, error: fErr } = await svc.from("sb_stier").update({ upload_udloeb_at: new Date(exp * 1000).toISOString() })
        .eq("bucket", BUCKET).eq("sti", sti).eq("status", "uploadet").is("upload_udloeb_at", null).select("sti");
      if (fErr || !fin || fin.length !== 1) return await opryd("finalisering_fejl");
      log("udstedt");
      // 4. Først nu udleveres token.
      return json({ sti, token: up.token });
    }

    // ---------- laes ----------
    if (req.method === "GET" && action === "laes") {
      const mid = new URL(req.url).searchParams.get("message_id") ?? "";
      if (!UUID.test(mid)) return json({ kode: "ugyldig" }, 400);
      const { data: m, error: mErr } = await bruger.from("chat_messages")
        .select("id, attachment_path, attachment_name, deleted_at, slettes_efter, status").eq("id", mid).maybeSingle();
      if (mErr) return json({ kode: "db" }, 500);
      if (!m) return json({ kode: "ikke_fundet" }, 404);
      if (!m.attachment_path || m.deleted_at || m.status === "trukket_tilbage"
        || (m.slettes_efter && new Date(m.slettes_efter).getTime() <= Date.now())) return json({ kode: "vaek" }, 410);
      const { data: reg, error: rErr } = await svc.from("sb_stier").select("status, besked_id").eq("bucket", BUCKET).eq("sti", m.attachment_path).maybeSingle();
      if (rErr) return json({ kode: "db" }, 500);
      if (!reg || reg.status !== "bundet" || reg.besked_id !== mid) return json({ kode: "vaek" }, 410);
      const { data: blob, error: dErr } = await svc.storage.from(BUCKET).download(m.attachment_path);
      if (dErr || !blob) return json({ kode: "vaek" }, 410);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const type = filtype(bytes);
      const ext = (/\.([a-z0-9]{1,5})$/i.exec(m.attachment_path)?.[1] ?? "").toLowerCase();
      if (!type || TYPER[ext] !== type) { log("type_afvist", { message_id: mid }); return json({ kode: "vaek" }, 410); }
      const r = range(req.headers.get("Range"), bytes.length);
      const faelles = {
        ...cors, "Content-Type": type, "Content-Disposition": disposition(m.attachment_name, type), "Accept-Ranges": "bytes",
        "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; sandbox",
      };
      if (r === "ugyldig") return new Response(null, { status: 416, headers: { ...faelles, "Content-Range": `bytes */${bytes.length}` } });
      if (r) {
        const del = bytes.subarray(r.start, r.slut + 1);
        return new Response(del, { status: 206, headers: { ...faelles, "Content-Length": String(del.length), "Content-Range": `bytes ${r.start}-${r.slut}/${bytes.length}` } });
      }
      return new Response(bytes, { status: 200, headers: { ...faelles, "Content-Length": String(bytes.length) } });
    }
    return json({ kode: "ugyldig" }, 400);
  } catch {
    log("fejl");
    return json({ kode: "fejl" }, 500);
  }
});
