// Kaspers ordre 23/10 2026: lukkede leads (hele året) på tværs af alle Adversus main-
// kampagner med "hjerte"/Hjerteforeningen → Excel i privat bucket tryg-report-exports.
// Pass-through: intet gemmes i Storks tabeller, ingen leadfelter logges. Kun masterData-
// felterne i MAPPING og resultatfelt 91278 læses. Ingen noter/fri tekst.
// mode "discover": kun metadata/antal (kampagner, status-antal, datoer, slettede-test).
import ExcelJS from "npm:exceljs@4.4.0";
import { requireAuthenticated, sharedCorsHeaders } from "../_shared/auth.ts";

const BASE = "https://api.adversus.io/v1";
const INVALID_FIELD_ID = 91278;
const BUCKET = "tryg-report-exports";
const PAGE_SIZE = 1000;
const CLOSED = ["success", "notInterested", "unqualified", "invalid"];
const YEAR_START = "2026-01-01";

type Row = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...sharedCorsHeaders, "Content-Type": "application/json" } });

const MAPPING: { col: string; labels: string[] }[] = [
  { col: "Navn", labels: ["navn1"] },
  { col: "Adresse", labels: ["adresse"] },
  { col: "Postnummer", labels: ["postnr"] },
  { col: "By", labels: ["by"] },
  { col: "E-mail", labels: [] },
  { col: "Mobilnummer", labels: ["telefonnummer2"] },
  { col: "Telefonnummer", labels: ["telefonnummer1"] },
];

function dkParts(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { y: g("year"), m: g("month"), d: g("day") };
}
const dkDate = (iso: string) => { const p = dkParts(iso); return p ? `${p.d}-${p.m}-${p.y}` : ""; };
function weekStart(iso: string): string {
  const p = dkParts(iso); if (!p) return "";
  const d = new Date(Date.UTC(+p.y, +p.m - 1, +p.d));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: sharedCorsHeaders });
  const auth = await requireAuthenticated(req);
  if (auth instanceof Response) return auth;
  const { svc, userId } = auth;
  const { data: isSa } = await svc.rpc("is_superadmin", { _user_id: userId });
  if (isSa !== true) return json(403, { error: "Kun superadmin" });

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "discover" ? "discover" : "export";
    const u = Deno.env.get("ADVERSUS_API_USERNAME"), p = Deno.env.get("ADVERSUS_API_PASSWORD");
    if (!u || !p) return json(500, { error: "Adversus-legitimation mangler" });
    const headers = { Authorization: `Basic ${btoa(`${u}:${p}`)}` };
    let apiCalls = 0;
    const get = async (path: string) => {
      let res: Response | null = null;
      for (let a = 0; a < 5; a++) {
        apiCalls++;
        res = await fetch(`${BASE}${path}`, { headers });
        if (res.status !== 429) break;
        await new Promise((r) => setTimeout(r, 2000 * (a + 1)));
      }
      return res!;
    };
    const arrOf = (d: unknown, ...keys: string[]) => {
      if (Array.isArray(d)) return d as Row[];
      for (const k of keys) { const v = (d as Row)?.[k]; if (Array.isArray(v)) return v as Row[]; }
      return [] as Row[];
    };

    // --- Kampagner ---
    const cRes = await get(`/campaigns`);
    if (!cRes.ok) return json(502, { error: `Adversus /campaigns fejlede (${cRes.status})` });
    const all = arrOf(await cRes.json(), "campaigns", "data");
    const campaigns = all.filter((c) => {
      const st = (c.settings ?? {}) as Row;
      const txt = `${s(c.name ?? st.name)} ${s(c.description ?? st.description)}`.toLowerCase();
      return txt.includes("hjerte");
    }).map((c) => {
      const st = (c.settings ?? {}) as Row;
      return {
        id: Number(c.id), name: s(c.name ?? st.name),
        active: c.active ?? st.active ?? null, archived: c.archived ?? st.archived ?? c.isArchived ?? null,
        status: s(c.status ?? st.status) || null, created: s(c.createdTime ?? c.created ?? st.createdTime) || null,
      };
    });
    const requested: number[] = Array.isArray(body?.campaignIds) ? body.campaignIds.map(Number).filter(Boolean) : [];
    const ids = requested.length ? requested : campaigns.map((c) => c.id);
    if (!ids.length) return json(404, { error: "Ingen Hjerteforeningen-kampagner fundet", campaignsTotal: all.length });

    // --- Leads pr. kampagne ---
    const statusPer: Record<number, Record<string, number>> = {};
    const rangePer: Record<number, { min: string; max: string }> = {};
    const out: string[][] = [];
    const counts: Record<string, Record<string, number>> = {};
    const weekly: Record<string, Record<string, number>> = {};
    const seen = new Set<string>();

    for (const cid of ids) {
      statusPer[cid] = {};
      for (let page = 1; page <= 500; page++) {
        const f = encodeURIComponent(JSON.stringify({ campaignId: { $eq: cid } }));
        const res = await get(`/leads?pageSize=${PAGE_SIZE}&page=${page}&filters=${f}`);
        if (!res.ok) return json(502, { error: `Adversus /leads fejlede (${res.status}) kampagne ${cid} side ${page} — intet gemt` });
        const arr = arrOf(await res.json(), "leads", "data");
        for (const lead of arr) {
          const id = s(lead.id);
          if (!id || seen.has(id) || Number(lead.campaignId) !== cid) continue;
          seen.add(id);
          const st = s(lead.status) || "(tom)";
          statusPer[cid][st] = (statusPer[cid][st] ?? 0) + 1;
          const t = s(lead.lastUpdatedTime);
          if (t) {
            const r = (rangePer[cid] ??= { min: t, max: t });
            if (t < r.min) r.min = t; if (t > r.max) r.max = t;
          }
          if (mode === "discover" || !CLOSED.includes(st)) continue;
          if (t && t < YEAR_START) continue;

          const md = new Map<string, string>();
          for (const fld of (Array.isArray(lead.masterData) ? lead.masterData : []) as Row[]) {
            const lbl = s(fld.label ?? fld.name).toLowerCase();
            if (!lbl) continue;
            const v = s(fld.value);
            if (!md.has(lbl) || (!md.get(lbl) && v)) md.set(lbl, v);
          }
          const pick = (labels: string[]) => { for (const l of labels) { const v = md.get(l); if (v) return v; } return ""; };

          let code = "";
          if (st === "success") code = "Succes";
          else if (st === "notInterested") code = "Nej tak";
          else if (st === "unqualified") code = "Ukvalificeret";
          else {
            const rf = ((Array.isArray(lead.resultData) ? lead.resultData : []) as Row[]).find((x) => Number(x.id) === INVALID_FIELD_ID);
            const rv = s(rf?.value);
            code = rv ? `Ugyldig – ${rv}` : "Max call (lukket af dialeren)";
          }
          (counts[cid] ??= {})[code] = (counts[cid][code] ?? 0) + 1;
          const wk = t ? weekStart(t) : "(ukendt)";
          (weekly[wk] ??= {})[cid] = (weekly[wk][cid] ?? 0) + 1;
          out.push([...MAPPING.map((m) => pick(m.labels)), t ? dkDate(t) : "", code, String(cid)]);
        }
        if (arr.length < PAGE_SIZE) break;
        if (page === 500) return json(502, { error: "For mange sider — afbrudt, intet gemt" });
      }
    }

    if (mode === "discover") {
      // Test om slettede leads kan hentes (kun antal).
      const deletedTest: Record<string, unknown> = {};
      for (const cid of ids) {
        const f = (o: unknown) => encodeURIComponent(JSON.stringify(o));
        const tries: Record<string, string> = {
          includeDeleted: `/leads?pageSize=1000&page=1&includeDeleted=true&filters=${f({ campaignId: { $eq: cid } })}`,
          deletedFilter: `/leads?pageSize=1000&page=1&filters=${f({ campaignId: { $eq: cid }, deleted: { $eq: true } })}`,
          isDeletedFilter: `/leads?pageSize=1000&page=1&filters=${f({ campaignId: { $eq: cid }, isDeleted: { $eq: true } })}`,
        };
        const r: Record<string, unknown> = {};
        for (const [k, path] of Object.entries(tries)) {
          const res = await get(path);
          if (!res.ok) { r[k] = { status: res.status }; continue; }
          const arr = arrOf(await res.json(), "leads", "data");
          r[k] = { status: res.status, antal: arr.length, medDeletedFelt: arr.filter((l) => l.deleted === true || l.isDeleted === true).length };
        }
        deletedTest[cid] = r;
      }
      return json(200, { campaigns, statusPer, rangePer, deletedTest, apiCalls, campaignsTotal: all.length });
    }

    // --- Afstemning mod weekly_lead_closure_stats ---
    const { data: wstats, error: wErr } = await svc.from("weekly_lead_closure_stats")
      .select("week_start, adversus_campaign_id, status, lead_count")
      .eq("account", "main").in("adversus_campaign_id", ids.map(String)).in("status", CLOSED).gte("week_start", "2025-12-29");
    if (wErr) return json(500, { error: "Kunne ikke læse ugestatistik" });
    const storkWeek: Record<string, Record<string, number>> = {};
    for (const w of wstats ?? []) {
      (storkWeek[w.week_start] ??= {})[w.adversus_campaign_id] = (storkWeek[w.week_start][w.adversus_campaign_id] ?? 0) + (w.lead_count ?? 0);
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "Copenhagen Sales";
    const ws = wb.addWorksheet("Lukkede leads");
    const cols = [...MAPPING.map((m) => m.col), "CPH Sales lukkedato", "CPH Sales lukkekode", "Kampagne"];
    ws.addRow(cols).font = { bold: true };
    ws.columns = cols.map(() => ({ width: 24 }));
    for (const r of out) ws.addRow(r);
    ws.views = [{ state: "frozen", ySplit: 1 }];

    const ws2 = wb.addWorksheet("Afstemning");
    const codes = [...new Set(Object.values(counts).flatMap((c) => Object.keys(c)))].sort();
    ws2.addRow(["Lukkekode", ...ids.map(String), "I alt"]).font = { bold: true };
    for (const code of codes) {
      const v = ids.map((c) => counts[c]?.[code] ?? 0);
      ws2.addRow([code, ...v, v.reduce((a, b) => a + b, 0)]);
    }
    const tot = ids.map((c) => Object.values(counts[c] ?? {}).reduce((a, b) => a + b, 0));
    ws2.addRow(["I alt", ...tot, out.length]).font = { bold: true };
    ws2.addRow([]);
    ws2.addRow(["Uge (mandag)", "Udtræk", "Stork ugestatistik", "Afvigelse (udtræk − Stork)"]).font = { bold: true };
    const weeks = [...new Set([...Object.keys(weekly), ...Object.keys(storkWeek)])].sort();
    const weekRows: { uge: string; udtraek: number; stork: number; afvigelse: number }[] = [];
    for (const wk of weeks) {
      const a = ids.reduce((n, c) => n + (weekly[wk]?.[c] ?? 0), 0);
      const b = ids.reduce((n, c) => n + (storkWeek[wk]?.[String(c)] ?? 0), 0);
      ws2.addRow([wk, a, b, a - b]);
      weekRows.push({ uge: wk, udtraek: a, stork: b, afvigelse: a - b });
    }
    ws2.addRow([]);
    ws2.addRow([`Kilde: Adversus main, kampagner ${ids.join(", ")}, lukkedato ≥ ${YEAR_START}, hentet ${new Date().toISOString()} (UTC)`]);
    ws2.columns = [{ width: 36 }, ...ids.map(() => ({ width: 14 })), { width: 14 }];

    const today = new Date().toISOString().slice(0, 10);
    const fileName = `Hjerteforeningen_lukkede_leads_hele_aaret_${today}.xlsx`;
    const buf = new Uint8Array(await wb.xlsx.writeBuffer() as ArrayBuffer);
    const up = await svc.storage.from(BUCKET).upload(fileName, buf, {
      upsert: true, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    if (up.error) return json(500, { error: "Upload fejlede" });
    const { data: signed } = await svc.storage.from(BUCKET).createSignedUrl(fileName, 300, { download: fileName });

    return json(200, {
      fileName, signedUrl: signed?.signedUrl ?? null, rows: out.length, campaigns, counts,
      statusPer, rangePer, weekRows, apiCalls,
    });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
