// beskeder-oprydning (S6 / 24d). Kun cron-token (x-pulsen-cron-token). Kræver sb_version() = '24d'.
// dry_run=true er fuldstændig skrivefri (kun læseopslag og estimater). Fysisk sletning sker KUN for poster
// returneret af sb_koe_naeste. Ingen personindhold i svar eller logs. Cron aktiveres ikke herfra.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "chat-attachments";
const FRIST_MS = 50_000;
const KOE_MAKS = 200;
const SAMTIDIGHED = 4;
const PO_BUNDT = 100;
const SIDE = 1000;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export function ensKonstantTid(a: string, b: string): boolean {
  const n = Math.max(a.length, b.length);
  let d = a.length ^ b.length;
  for (let i = 0; i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
async function sha256Hex(t: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function iOptaellingsvindue(d = new Date()): boolean {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", hour: "2-digit", hour12: false }).format(d));
  return h === 3;
}

type Svc = ReturnType<typeof createClient>;

/** Fuldstændig, pagineret og rekursiv optælling af objekter (mapper tælles ikke). null = ufuldstændig/fejl. */
async function alleObjekter(svc: Svc, frist: number): Promise<string[] | null> {
  const ud: string[] = [];
  const koe: string[] = [""];
  while (koe.length) {
    const prefix = koe.shift()!;
    for (let offset = 0; ; offset += SIDE) {
      if (Date.now() > frist) return null;
      const { data, error } = await svc.storage.from(BUCKET).list(prefix, { limit: SIDE, offset, sortBy: { column: "name", order: "asc" } });
      if (error || !Array.isArray(data)) return null;
      for (const o of data) {
        const sti = prefix ? `${prefix}/${o.name}` : o.name;
        if (o.id === null || o.id === undefined) koe.push(sti); else ud.push(sti);
      }
      if (data.length < SIDE) break;
    }
  }
  return ud;
}

async function registerStier(svc: Svc, frist: number): Promise<Set<string> | null> {
  const s = new Set<string>();
  for (let fra = 0; ; fra += SIDE) {
    if (Date.now() > frist) return null;
    const { data, error } = await svc.from("sb_stier").select("sti").eq("bucket", BUCKET).order("sti").range(fra, fra + SIDE - 1);
    if (error) return null;
    for (const r of data ?? []) s.add((r as { sti: string }).sti);
    if ((data ?? []).length < SIDE) return s;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const start = Date.now();
  const frist = start + FRIST_MS;
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    const hdr = req.headers.get("x-pulsen-cron-token") ?? "";
    if (!hdr) return json({ error: "Ingen adgang" }, 403);
    const { data: cfg, error: cfgErr } = await svc.from("pulsen_config").select("value").eq("key", "cron_token_sha256").maybeSingle();
    if (cfgErr) return json({ error: "konfiguration" }, 500);
    const forventet = (cfg as { value: unknown } | null)?.value;
    if (typeof forventet !== "string" || !ensKonstantTid(await sha256Hex(hdr), forventet)) return json({ error: "Ingen adgang" }, 403);
    const ver = await svc.rpc("sb_version");
    if (ver.error || ver.data !== "24d") return json({ error: "24d mangler" }, 503);
    const body = await req.json().catch(() => ({}));
    const dry = body?.dry_run === true;

    if (dry) {
      const nu = new Date().toISOString();
      const [koe, foraeldre, po] = await Promise.all([
        svc.from("sb_filsletninger").select("id", { count: "exact", head: true }).is("slettet_at", null).or("fejl.is.null,fejl.neq.uden_verificeret_binding"),
        svc.from("sb_stier").select("sti", { count: "exact", head: true }).eq("status", "uploadet").lt("oprettet", new Date(Date.now() - 3 * 3600_000).toISOString()),
        svc.rpc("sb_personoplysninger_til_sletning").select("kilde"),
      ]);
      const fejl = [koe.error && "koe", foraeldre.error && "foraeldreloese", po.error && "personoplysninger"].filter(Boolean);
      return json({
        ok: fejl.length === 0, dry_run: true, estimat: {
          koeposter: koe.count ?? null, foraeldreloese: foraeldre.count ?? null,
          personoplysninger: Array.isArray(po.data) ? po.data.length : null,
        }, fejl, tidspunkt: nu, varighed_ms: Date.now() - start,
      });
    }

    const fejl: string[] = [];
    const rester: Record<string, boolean> = {};
    // 1. Forældreløse uploads → kø (DB respekterer slet_tidligst).
    const ov = await svc.rpc("sb_overtag_foraeldreloese", { p_limit: 100 });
    if (ov.error) fejl.push("overtag");
    const foraeldreloese = typeof ov.data === "number" ? ov.data : 0;

    // 2. Kø → Storage-remove (kun poster fra sb_koe_naeste).
    let slettet = 0, behandlet = 0;
    while (behandlet < KOE_MAKS && Date.now() < frist) {
      const { data, error } = await svc.rpc("sb_koe_naeste", { p_limit: Math.min(50, KOE_MAKS - behandlet) });
      if (error) { fejl.push("koe_naeste"); break; }
      const poster = (data ?? []) as { id: number; bucket: string; sti: string }[];
      if (!poster.length) break;
      behandlet += poster.length;
      for (let i = 0; i < poster.length; i += SAMTIDIGHED) {
        await Promise.all(poster.slice(i, i + SAMTIDIGHED).map(async (p) => {
          const rm = await svc.storage.from(p.bucket).remove([p.sti]).catch(() => ({ error: new Error("netvaerk") }));
          // remove() giver ingen fejl for et objekt, der ikke findes – det er succes.
          const ok = !rm.error;
          const af = await svc.rpc("sb_koe_afslut", { p_id: p.id, p_ok: ok, p_fejl: ok ? null : "storage_fejl" });
          if (af.error || af.data !== true) fejl.push("koe_afslut");
          if (!ok) fejl.push("storage_fejl"); else slettet++;
        }));
      }
      if (poster.length < 50) break;
    }
    if (behandlet >= KOE_MAKS || Date.now() >= frist) rester.koe = true;

    // 3. Udløbne persondata: genforespørg efter hver runde (sletning fjerner rækkerne fra udvælgelsen; ingen offset).
    let personoplysninger = 0;
    for (let runde = 0; Date.now() < frist; runde++) {
      const { data, error } = await svc.rpc("sb_personoplysninger_til_sletning");
      if (error) { fejl.push("po_udvaelg"); break; }
      const rows = (data ?? []) as { kilde: string; kilde_id: string }[];
      if (!rows.length) break;
      const pr = new Map<string, string[]>();
      for (const r of rows) pr.set(r.kilde, [...(pr.get(r.kilde) ?? []), r.kilde_id]);
      let rundens = 0;
      for (const [kilde, ids] of pr) {
        for (let i = 0; i < ids.length && Date.now() < frist; i += PO_BUNDT) {
          const { data: n, error: sErr } = await svc.rpc("sb_slet_personoplysninger", { p_kilde: kilde, p_ids: ids.slice(i, i + PO_BUNDT) });
          if (sErr) { fejl.push("po_slet"); continue; }
          rundens += typeof n === "number" ? n : 0;
        }
      }
      personoplysninger += rundens;
      if (rundens === 0) { rester.personoplysninger = true; break; }
    }
    if (Date.now() >= frist) rester.personoplysninger = true;

    // 4. Minimering.
    const mi = await svc.rpc("sb_minimer_register");
    if (mi.error) fejl.push("minimer");
    const minimeret = typeof mi.data === "number" ? mi.data : 0;

    // 5. Kl. 03–04 dansk: komplet lageroptælling; skrives kun ved komplet optælling (fejl er ikke nul).
    let objekter_uden_register: number | null = null;
    if (iOptaellingsvindue()) {
      const [obj, reg] = await Promise.all([alleObjekter(svc, frist), registerStier(svc, frist)]);
      if (obj && reg) {
        objekter_uden_register = obj.filter((s) => !reg.has(s)).length;
        const d = await svc.rpc("sb_dagstal_objekter", { p_antal: objekter_uden_register });
        if (d.error) fejl.push("dagstal");
      } else { fejl.push("optaelling"); rester.optaelling = true; }
    }

    const ok = fejl.length === 0;
    console.log("beskeder-oprydning", { ok, fejl: [...new Set(fejl)], varighed_ms: Date.now() - start });
    return json({ ok, dry_run: false, foraeldreloese, slettet, fejl: [...new Set(fejl)], personoplysninger, minimeret, objekter_uden_register, rester, varighed_ms: Date.now() - start });
  } catch {
    return json({ ok: false, fejl: ["koersel"], varighed_ms: Date.now() - start }, 500);
  }
});
