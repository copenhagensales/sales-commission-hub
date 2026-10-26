// Udtræk 26/10 2026: afsluttede emner uge for uge for rapportlinjen Finansforbundet (Tryg).
// Fane 1: Storks ugestatistik (weekly_lead_closure_stats) pr. uge/sælger/status/årsag.
// Fane 2: pr. emne fra Adversus (kun id, kampagne, status, lastContactedBy, updated og
// årsagsfelt 91278 ved invalid). Ingen masterData, ingen fritekst. Intet gemmes i tabeller.
import ExcelJS from "npm:exceljs@4.4.0";
import { requireAuthenticated, sharedCorsHeaders } from "../_shared/auth.ts";

const BASE = "https://api.adversus.io/v1";
const BUCKET = "tryg-report-exports";
const LINE = "Finansforbundet";
const YEAR_START = "2025-12-29";
const PAGE_SIZE = 1000;
const OUR_DOMAIN = "@copenhagensales.dk";
const REASON_FIELD = 91278;
const REASONS = [
  "De har allerede modtaget et tilbud fra TRYG",
  "Er ikke en del af FDM",
  "Forkert nummer",
  "Forkert info på kontaktperson",
  "Andet",
];
const LABEL: Record<string, string> = {
  success: "Succes (møde booket)",
  notInterested: "Nej tak",
  invalid: "Ugyldig",
  unqualified: "Ukvalificeret",
};
const BAD = new Set(["invalid", "unqualified"]);

type Row = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...sharedCorsHeaders, "Content-Type": "application/json" } });
const arrOf = (d: unknown, ...keys: string[]) => {
  if (Array.isArray(d)) return d as Row[];
  for (const k of keys) { const v = (d as Row)?.[k]; if (Array.isArray(v)) return v as Row[]; }
  return [] as Row[];
};
function dkDay(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function monday(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function isoWeek(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const y = d.getUTCFullYear();
  const w = 1 + Math.round(((d.getTime() - Date.UTC(y, 0, 4)) / 86400000 - 3 + ((new Date(Date.UTC(y, 0, 4)).getUTCDay() + 6) % 7)) / 7);
  return `${y}-U${String(w).padStart(2, "0")}`;
}
function reasonOf(lead: Row): string {
  for (const f of (Array.isArray(lead.resultData) ? lead.resultData : []) as Row[]) {
    if (Number(f?.id) !== REASON_FIELD) continue;
    const v = s(f.value);
    return !v ? "" : REASONS.includes(v) ? v : "Andet";
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: sharedCorsHeaders });
  const auth = await requireAuthenticated(req);
  if (auth instanceof Response) return auth;
  const { svc, userId } = auth;
  const { data: isSa } = await svc.rpc("is_superadmin", { _user_id: userId });
  if (isSa !== true) return json(403, { error: "Kun superadmin" });

  try {
    const u = Deno.env.get("ADVERSUS_API_USERNAME"), p = Deno.env.get("ADVERSUS_API_PASSWORD");
    if (!u || !p) return json(500, { error: "Adversus-legitimation mangler" });
    const headers = { Authorization: `Basic ${btoa(`${u}:${p}`)}` };
    const get = async (path: string): Promise<unknown> => {
      for (let a = 0; ; a++) {
        const res = await fetch(`${BASE}${path}`, { headers });
        if (res.ok) return await res.json();
        if ((res.status !== 429 && res.status < 500) || a >= 4) throw new Error(`Adversus ${path.split("?")[0]} svarede ${res.status}`);
        await new Promise((r) => setTimeout(r, 2000 * (a + 1)));
      }
    };

    const [{ data: map, error: mErr }, { data: closing, error: cErr }] = await Promise.all([
      svc.from("weekly_lead_report_campaign_map").select("account, adversus_campaign_id, adversus_campaign_name").eq("report_line", LINE),
      svc.from("lead_closing_statuses").select("status, is_closing"),
    ]);
    if (mErr || cErr) return json(500, { error: "Kunne ikke læse opsætning" });
    const closingSet = new Set((closing ?? []).filter((c) => c.is_closing).map((c) => c.status as string));
    const campaigns = (map ?? []).filter((m) => m.account === "main");
    if (!campaigns.length) return json(404, { error: "Ingen Finansforbundet-kampagner koblet" });
    const campName = new Map(campaigns.map((c) => [String(c.adversus_campaign_id), s(c.adversus_campaign_name) || String(c.adversus_campaign_id)]));

    // Sælgernavne (kun vores egne brugere)
    const names = new Map<string, string>();
    for (const usr of arrOf(await get("/users?pageSize=1000"), "users", "data")) {
      const email = s(usr.email ?? usr.username).toLowerCase();
      const id = s(usr.id ?? usr.userId);
      if (id && email.endsWith(OUR_DOMAIN)) names.set(id, s(usr.name ?? usr.displayName) || `Adversus-bruger ${id}`);
    }
    const seller = (id: string) => (id ? names.get(id) ?? `Adversus-bruger ${id}` : "(ingen sælger)");

    // Fane 1: Storks ugestatistik
    const { data: stats, error: sErr } = await svc.from("weekly_lead_closure_stats")
      .select("week_start, adversus_campaign_id, agent_reference, status, invalid_reason, lead_count")
      .eq("report_line", LINE).gte("week_start", YEAR_START).limit(20000);
    if (sErr) return json(500, { error: "Kunne ikke læse ugestatistik" });
    const agg = new Map<string, number>();
    const storkWeek: Record<string, number> = {};
    for (const r of stats ?? []) {
      if (!closingSet.has(r.status)) continue;
      const ref = s(r.agent_reference).replace(/^main:/, "");
      const key = [r.week_start, ref, r.status, BAD.has(r.status) ? s(r.invalid_reason) : ""].join("|");
      agg.set(key, (agg.get(key) ?? 0) + (r.lead_count ?? 0));
      storkWeek[r.week_start] = (storkWeek[r.week_start] ?? 0) + (r.lead_count ?? 0);
    }

    // Fane 2: pr. emne fra Adversus
    const leads: { id: string; camp: string; day: string; wk: string; seller: string; status: string; reason: string }[] = [];
    const seen = new Set<string>();
    for (const c of campaigns) {
      const cid = String(c.adversus_campaign_id);
      const f = encodeURIComponent(JSON.stringify({ campaignId: { $eq: /^\d+$/.test(cid) ? Number(cid) : cid } }));
      for (let page = 1; ; page++) {
        if (page > 500) return json(502, { error: "For mange sider — afbrudt, intet gemt" });
        const arr = arrOf(await get(`/leads?filters=${f}&pageSize=${PAGE_SIZE}&page=${page}`), "leads", "data");
        for (const lead of arr) {
          const id = s(lead.id);
          const st = s(lead.status);
          if (!id || seen.has(id) || !closingSet.has(st)) continue;
          seen.add(id);
          const day = dkDay(s(lead.updated));
          if (!day || day < YEAR_START) continue;
          leads.push({
            id, camp: campName.get(cid) ?? cid, day, wk: monday(day), seller: seller(s(lead.lastContactedBy)),
            status: st, reason: st === "invalid" ? reasonOf(lead) : "",
          });
        }
        if (arr.length < PAGE_SIZE) break;
      }
    }
    leads.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.seller.localeCompare(b.seller)));

    // Excel
    const wb = new ExcelJS.Workbook();
    wb.creator = "Copenhagen Sales";
    const badFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFDE2E2" } };
    const head = (ws: ExcelJS.Worksheet, cols: { h: string; w: number }[]) => {
      ws.columns = cols.map((c) => ({ width: c.w }));
      ws.addRow(cols.map((c) => c.h)).font = { bold: true };
      ws.views = [{ state: "frozen", ySplit: 1 }];
    };

    const ws1 = wb.addWorksheet("Pr. uge og sælger");
    head(ws1, [
      { h: "Uge", w: 11 }, { h: "Uge start (mandag)", w: 18 }, { h: "Sælger", w: 28 }, { h: "Status", w: 22 },
      { h: "Årsag (ugyldig)", w: 42 }, { h: "Antal", w: 9 }, { h: "Sælgerens lukkede i ugen", w: 14 }, { h: "Andel ugyldig/ukvalificeret for sælgeren i ugen", w: 18 },
    ]);
    const rows1 = [...agg.entries()].map(([k, n]) => {
      const [wk, ref, st, reason] = k.split("|");
      return { wk, name: seller(ref), st, reason, n };
    }).sort((a, b) => (a.wk < b.wk ? -1 : a.wk > b.wk ? 1 : a.name.localeCompare(b.name) || a.st.localeCompare(b.st)));
    const first = 2, last = rows1.length + 1;
    rows1.forEach((r, i) => {
      const rn = i + 2;
      const row = ws1.addRow([
        isoWeek(r.wk), r.wk, r.name, LABEL[r.st] ?? r.st, r.reason, r.n,
        { formula: `SUMIFS($F$${first}:$F$${last},$B$${first}:$B$${last},B${rn},$C$${first}:$C$${last},C${rn})` },
        { formula: `IFERROR((SUMIFS($F$${first}:$F$${last},$B$${first}:$B$${last},B${rn},$C$${first}:$C$${last},C${rn},$D$${first}:$D$${last},"${LABEL.invalid}")+SUMIFS($F$${first}:$F$${last},$B$${first}:$B$${last},B${rn},$C$${first}:$C$${last},C${rn},$D$${first}:$D$${last},"${LABEL.unqualified}"))/G${rn},0)` },
      ]);
      row.getCell(8).numFmt = "0.0%";
      if (BAD.has(r.st)) row.eachCell((c) => { c.fill = badFill; });
    });
    ws1.autoFilter = { from: "A1", to: "H1" };

    const ws2 = wb.addWorksheet("Pr. emne");
    head(ws2, [
      { h: "Emne-nr. (Adversus)", w: 18 }, { h: "Kampagne", w: 32 }, { h: "Afsluttet dato", w: 14 }, { h: "Uge", w: 11 },
      { h: "Sælger", w: 28 }, { h: "Status", w: 22 }, { h: "Årsag (ugyldig)", w: 42 },
    ]);
    for (const l of leads) {
      const row = ws2.addRow([l.id, l.camp, l.day, isoWeek(l.wk), l.seller, LABEL[l.status] ?? l.status, l.reason]);
      if (BAD.has(l.status)) row.eachCell((c) => { c.fill = badFill; });
    }
    ws2.autoFilter = { from: "A1", to: "G1" };

    // Afstemning pr. uge
    const leadWeek: Record<string, number> = {};
    for (const l of leads) leadWeek[l.wk] = (leadWeek[l.wk] ?? 0) + 1;
    const ws3 = wb.addWorksheet("Afstemning");
    head(ws3, [{ h: "Uge start", w: 14 }, { h: "Fane 1 (Stork-statistik)", w: 22 }, { h: "Fane 2 (Adversus nu)", w: 22 }, { h: "Afvigelse", w: 12 }]);
    const weeks = [...new Set([...Object.keys(storkWeek), ...Object.keys(leadWeek)])].sort();
    const weekRows = weeks.map((wk) => ({ uge: wk, stork: storkWeek[wk] ?? 0, adversus: leadWeek[wk] ?? 0 }));
    weekRows.forEach((w, i) => ws3.addRow([w.uge, w.stork, w.adversus, { formula: `C${i + 2}-B${i + 2}` }]));
    ws3.addRow([]);
    ws3.addRow(["Afvigelser skyldes typisk, at emner er genåbnet, flyttet eller slettet i Adversus efter ugen blev talt. Fane 2 viser emnets nuværende status og seneste sælger."]);
    ws3.addRow([`Hentet ${new Date().toISOString()} (UTC). Kampagner: ${[...campName.values()].join(", ")}.`]);

    const today = new Date().toISOString().slice(0, 10);
    const fileName = `Finansforbundet_afsluttede_emner_uge_for_uge_${today}.xlsx`;
    const buf = new Uint8Array(await wb.xlsx.writeBuffer() as ArrayBuffer);
    const up = await svc.storage.from(BUCKET).upload(fileName, buf, {
      upsert: true, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    if (up.error) return json(500, { error: "Upload fejlede" });
    const { data: signed } = await svc.storage.from(BUCKET).createSignedUrl(fileName, 300, { download: fileName });

    return json(200, { fileName, signedUrl: signed?.signedUrl ?? null, rows: leads.length, weeklyRows: rows1.length, weekRows });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
