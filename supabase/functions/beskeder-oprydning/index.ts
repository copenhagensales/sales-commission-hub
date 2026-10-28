// beskeder-oprydning (S6 / 24d). Kun cron-token (x-pulsen-cron-token). Kræver sb_version() = '24d'.
// dry_run=true er fuldstændig skrivefri (kun læseopslag og estimater). Fysisk sletning sker KUN for poster
// returneret af sb_koe_naeste. Ingen personindhold i svar eller logs. Cron aktiveres ikke herfra.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { budgetIndstillinger, laesBegraenset } from "../_shared/sb-budget.ts";

const BUCKET = "chat-attachments";
/** Efter FRIST_MS fra handlerstart startes intet nyt arbejde. */
const FRIST_MS = 50_000;
/** Absolut slutfrist for alle kald (inkl. remove + sb_koe_afslut). */
const SLUT_MS = 58_000;
const KALD_MS = 8_000;
/** sb_slet_personoplysninger og sb_overtag_foraeldreloese. Timeoutpolitik, ikke bevis for databaseydelse. */
const TUNG_MS = 15_000;
const MAKS_KROP = 4096;
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

const lavKlient = (slut: number, ms: number) =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, budgetIndstillinger(() => slut, ms));
type Svc = ReturnType<typeof lavKlient>;

/** Optællingsudfald: budgetstop skelnes fra reel fejl. */
export type Optaelling<T> = { s: "ok"; v: T } | { s: "budget" } | { s: "fejl" };

/** Fuldstændig, pagineret og rekursiv optælling af objekter (mapper tælles ikke). */
async function alleObjekter(svc: Svc, frist: number): Promise<Optaelling<string[]>> {
  const ud: string[] = [];
  const koe: string[] = [""];
  while (koe.length) {
    const prefix = koe.shift()!;
    for (let offset = 0; ; offset += SIDE) {
      if (Date.now() >= frist) return { s: "budget" };
      let r;
      try { r = await svc.storage.from(BUCKET).list(prefix, { limit: SIDE, offset, sortBy: { column: "name", order: "asc" } }); }
      catch { return { s: "fejl" }; }
      const { data, error } = r;
      if (error || !Array.isArray(data)) return { s: "fejl" };
      for (const o of data) {
        const sti = prefix ? `${prefix}/${o.name}` : o.name;
        if (o.id === null || o.id === undefined) koe.push(sti); else ud.push(sti);
      }
      if (data.length < SIDE) break;
    }
  }
  return { s: "ok", v: ud };
}

async function registerStier(svc: Svc, frist: number): Promise<Optaelling<Set<string>>> {
  const st = new Set<string>();
  for (let fra = 0; ; fra += SIDE) {
    if (Date.now() >= frist) return { s: "budget" };
    let r;
    try { r = await svc.from("sb_stier").select("sti").eq("bucket", BUCKET).order("sti").range(fra, fra + SIDE - 1); }
    catch { return { s: "fejl" }; }
    if (r.error) return { s: "fejl" };
    for (const x of r.data ?? []) st.add((x as { sti: string }).sti);
    if ((r.data ?? []).length < SIDE) return { s: "ok", v: st };
  }
}

/** Kald, der normaliserer kastede exceptions (timeout/transport) til {error}. */
async function kald<T extends { data: unknown; error: unknown }>(f: () => PromiseLike<T>): Promise<{ data: T["data"] | null; error: unknown }> {
  try { const r = await f(); return { data: r.data, error: r.error }; } catch (e) { return { data: null, error: e ?? "undtagelse" }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const start = Date.now();
  const frist = start + FRIST_MS;
  const slut = start + SLUT_MS;
  const svc = lavKlient(slut, KALD_MS);
  const tung = lavKlient(slut, TUNG_MS);
  const tid = () => Date.now() < frist;
  try {
    const hdr = req.headers.get("x-pulsen-cron-token") ?? "";
    if (!hdr) return json({ error: "Ingen adgang" }, 403);
    const { data: cfg, error: cfgErr } = await kald(() => svc.from("pulsen_config").select("value").eq("key", "cron_token_sha256").maybeSingle());
    if (cfgErr) return json({ error: "konfiguration" }, 500);
    const forventet = (cfg as { value: unknown } | null)?.value;
    if (typeof forventet !== "string" || !ensKonstantTid(await sha256Hex(hdr), forventet)) return json({ error: "Ingen adgang" }, 403);
    const ver = await kald(() => svc.rpc("sb_version"));
    if (ver.error || ver.data !== "24d") return json({ error: "24d mangler" }, 503);
    // Request-body læses begrænset inden for arbejdsfristen; budgetstop starter intet efterfølgende arbejde.
    const krop = await laesBegraenset(req.body, MAKS_KROP, frist);
    if (!krop.ok) {
      if (krop.grund === "frist") {
        console.log("beskeder-oprydning", { kode: "budget", varighed_ms: Date.now() - start });
        return json({ ok: true, dry_run: false, fejl: [], rester: { foraeldreloese: true, koe: true, personoplysninger: true, minimering: true }, varighed_ms: Date.now() - start });
      }
      return json({ ok: false, fejl: ["koersel"], varighed_ms: Date.now() - start }, 500);
    }
    let body: { dry_run?: unknown } = {};
    try { body = krop.bytes.length ? JSON.parse(new TextDecoder().decode(krop.bytes)) : {}; } catch { body = {}; }
    const dry = body?.dry_run === true;

    if (dry) {
      // Fuldstændig skrivefri; samme budgetbeskyttelse mod langsomme kald.
      const nu = new Date().toISOString();
      const taelling = async (f: () => PromiseLike<{ count: number | null; error: unknown }>) => {
        try { const r = await f(); return r.error ? { fejl: true, n: null } : { fejl: false, n: r.count ?? null }; } catch { return { fejl: true, n: null }; }
      };
      const [koe, foraeldre, po] = await Promise.all([
        taelling(() => svc.from("sb_filsletninger").select("id", { count: "exact", head: true }).is("slettet_at", null).or("fejl.is.null,fejl.neq.uden_verificeret_binding")),
        taelling(() => svc.from("sb_stier").select("sti", { count: "exact", head: true }).eq("status", "uploadet").lt("oprettet", new Date(Date.now() - 3 * 3600_000).toISOString())),
        kald(() => svc.rpc("sb_personoplysninger_til_sletning").select("kilde")),
      ]);
      const fejl = [koe.fejl && "koe", foraeldre.fejl && "foraeldreloese", po.error && "personoplysninger"].filter(Boolean);
      return json({
        ok: fejl.length === 0, dry_run: true, estimat: {
          koeposter: koe.n, foraeldreloese: foraeldre.n,
          personoplysninger: Array.isArray(po.data) ? po.data.length : null,
        }, fejl, tidspunkt: nu, varighed_ms: Date.now() - start,
      });
    }

    const fejl: string[] = [];
    const rester: Record<string, boolean> = {};
    let budget = false;
    const stop = (trin: string) => { rester[trin] = true; budget = true; };

    // 1. Forældreløse uploads → kø (DB respekterer slet_tidligst). Tungt kald: op til 15 s, afkortet af slutfristen.
    let foraeldreloese = 0;
    if (!tid()) stop("foraeldreloese");
    else {
      const ov = await kald(() => tung.rpc("sb_overtag_foraeldreloese", { p_limit: 100 }));
      if (ov.error) { fejl.push("overtag"); rester.foraeldreloese = true; }
      foraeldreloese = typeof ov.data === "number" ? ov.data : 0;
    }

    // 2. Kø → Storage-remove (kun poster fra sb_koe_naeste). remove og sb_koe_afslut deler den absolutte slutfrist.
    // Ikke-nåede afhentede poster beholder reservationen til SQL'ens genforsøgsvindue (ingen manuel frigivelse).
    let slettet = 0, behandlet = 0;
    koeloekke: while (behandlet < KOE_MAKS) {
      if (!tid()) { stop("koe"); break; }
      const { data, error } = await kald(() => svc.rpc("sb_koe_naeste", { p_limit: Math.min(50, KOE_MAKS - behandlet) }));
      if (error) { fejl.push("koe_naeste"); rester.koe = true; break; }
      const poster = (data ?? []) as { id: number; bucket: string; sti: string }[];
      if (!poster.length) break;
      behandlet += poster.length;
      for (let i = 0; i < poster.length; i += SAMTIDIGHED) {
        if (!tid()) { stop("koe"); break koeloekke; }
        await Promise.all(poster.slice(i, i + SAMTIDIGHED).map(async (p) => {
          // remove() giver ingen fejl for et objekt, der ikke findes – det er succes. Afbrudt remove er ikke bekræftet.
          const rm = await kald(() => svc.storage.from(p.bucket).remove([p.sti]));
          const ok = !rm.error;
          const af = await kald(() => svc.rpc("sb_koe_afslut", { p_id: p.id, p_ok: ok, p_fejl: ok ? null : "storage_fejl" }));
          if (af.error || af.data !== true) { fejl.push("koe_afslut"); rester.koe = true; }
          if (!ok) { fejl.push("storage_fejl"); rester.koe = true; } else if (!af.error && af.data === true) slettet++;
        }));
      }
      if (poster.length < 50) break;
    }
    if (behandlet >= KOE_MAKS) rester.koe = true;

    // 3. Udløbne persondata: genforespørg efter hver runde (sletning fjerner rækkerne fra udvælgelsen; ingen offset).
    let personoplysninger = 0;
    poloekke: while (true) {
      if (!tid()) { stop("personoplysninger"); break; }
      const { data, error } = await kald(() => svc.rpc("sb_personoplysninger_til_sletning"));
      if (error) { fejl.push("po_udvaelg"); rester.personoplysninger = true; break; }
      const rows = (data ?? []) as { kilde: string; kilde_id: string }[];
      if (!rows.length) break;
      const pr = new Map<string, string[]>();
      for (const r of rows) pr.set(r.kilde, [...(pr.get(r.kilde) ?? []), r.kilde_id]);
      let rundens = 0;
      for (const [kilde, ids] of pr) {
        for (let i = 0; i < ids.length; i += PO_BUNDT) {
          if (!tid()) { stop("personoplysninger"); personoplysninger += rundens; break poloekke; }
          const { data: n, error: sErr } = await kald(() => tung.rpc("sb_slet_personoplysninger", { p_kilde: kilde, p_ids: ids.slice(i, i + PO_BUNDT) }));
          if (sErr) { fejl.push("po_slet"); rester.personoplysninger = true; continue; }
          rundens += typeof n === "number" ? n : 0;
        }
      }
      personoplysninger += rundens;
      if (rundens === 0) { rester.personoplysninger = true; break; }
    }

    // 4. Minimering.
    let minimeret = 0;
    if (!tid()) stop("minimering");
    else {
      const mi = await kald(() => svc.rpc("sb_minimer_register"));
      if (mi.error) { fejl.push("minimer"); rester.minimering = true; }
      minimeret = typeof mi.data === "number" ? mi.data : 0;
    }

    // 5. Kl. 03–04 dansk: komplet lageroptælling; dagstal skrives kun ved komplet optælling OG tid tilbage.
    let objekter_uden_register: number | null = null;
    if (iOptaellingsvindue()) {
      const [obj, reg] = await Promise.all([alleObjekter(svc, frist), registerStier(svc, frist)]);
      if (obj.s === "fejl" || reg.s === "fejl") { fejl.push("optaelling"); rester.optaelling = true; }
      else if (obj.s === "budget" || reg.s === "budget") stop("optaelling");
      else if (!tid()) stop("optaelling");
      else {
        const antal = obj.v.filter((x) => !reg.v.has(x)).length;
        const d = await kald(() => svc.rpc("sb_dagstal_objekter", { p_antal: antal }));
        if (d.error) { fejl.push("dagstal"); rester.optaelling = true; } else objekter_uden_register = antal;
      }
    }

    const ok = fejl.length === 0;
    const koder = [...new Set(fejl)];
    if (budget) console.log("beskeder-oprydning", { kode: "budget", varighed_ms: Date.now() - start });
    console.log("beskeder-oprydning", { ok, fejl: koder, varighed_ms: Date.now() - start });
    return json({ ok, dry_run: false, foraeldreloese, slettet, fejl: koder, personoplysninger, minimeret, objekter_uden_register, rester, varighed_ms: Date.now() - start });
  } catch {
    return json({ ok: false, fejl: ["koersel"], varighed_ms: Date.now() - start }, 500);
  }
});
