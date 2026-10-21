// ENGANGS pass-through på Kaspers ordre (21/10 2026): lukkede leads på Adversus
// main-kampagne 104835 "Hjerteforeningen" → Excel i privat bucket tryg-report-exports.
// Intet gemmes i Storks tabeller, intet logges. Kun masterData-felterne i MAPPING
// og resultatfelt 91278 (godkendt undtagelse 25/9 2026) læses. Ingen noter/fri tekst.
import ExcelJS from "npm:exceljs@4.4.0";
import { requireAuthenticated, sharedCorsHeaders } from "../_shared/auth.ts";

const BASE = "https://api.adversus.io/v1";
const CAMPAIGN_ID = 104835;
const INVALID_FIELD_ID = 91278;
const BUCKET = "tryg-report-exports";
const PAGE_SIZE = 1000;
const CLOSED = ["success", "notInterested", "unqualified", "invalid"];

type Row = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...sharedCorsHeaders, "Content-Type": "application/json" } });

// Kolonne → mulige masterData-labels (case-insensitiv, eksakt match efter trim).
const MAPPING: { col: string; labels: string[] }[] = [
  { col: "Navn", labels: ["navn1"] },
  { col: "Adresse", labels: ["adresse"] },
  { col: "Postnummer", labels: ["postnr"] },
  { col: "By", labels: ["by"] },
  { col: "E-mail", labels: [] },
  { col: "Mobilnummer", labels: ["telefonnummer2"] },
  { col: "Telefonnummer", labels: ["telefonnummer1"] },
];


function dkDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("day")}-${g("month")}-${g("year")}`;
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
    let apiCalls = 0;

    const statusAll: Record<string, number> = {};
    const labelFill: Record<string, number> = {};
    const timeKeyUsed: Record<string, number> = {};
    const out: string[][] = [];
    const counts: Record<string, number> = {};
    const seen = new Set<string>();

    for (let page = 1; page <= 500; page++) {
      const f = encodeURIComponent(JSON.stringify({ campaignId: { $eq: CAMPAIGN_ID } }));
      let res: Response | null = null;
      for (let a = 0; a < 5; a++) {
        apiCalls++;
        res = await fetch(`${BASE}/leads?pageSize=${PAGE_SIZE}&page=${page}&filters=${f}`, { headers });
        if (res.status !== 429) break;
        await new Promise((r) => setTimeout(r, 2000 * (a + 1)));
      }
      if (!res || !res.ok) return json(502, { error: `Adversus /leads fejlede (status ${res?.status}) side ${page} — intet gemt` });
      const d = await res.json();
      const arr = (Array.isArray(d) ? d : d?.leads ?? d?.data ?? []) as Row[];
      for (const lead of arr) {
        const id = s(lead.id);
        if (!id || seen.has(id) || Number(lead.campaignId) !== CAMPAIGN_ID) continue;
        seen.add(id);
        const st = s(lead.status);
        statusAll[st || "(tom)"] = (statusAll[st || "(tom)"] ?? 0) + 1;
        if (!CLOSED.includes(st)) continue;

        const md = new Map<string, string>();
        for (const fld of (Array.isArray(lead.masterData) ? lead.masterData : []) as Row[]) {
          const lbl = s(fld.label ?? fld.name).toLowerCase();
          if (!lbl) continue;
          const v = s(fld.value);
          if (v) labelFill[lbl] = (labelFill[lbl] ?? 0) + 1; else labelFill[lbl] ??= 0;
          if (!md.has(lbl) || (!md.get(lbl) && v)) md.set(lbl, v);
        }
        const pick = (labels: string[]) => { for (const l of labels) { const v = md.get(l); if (v) return v; } return ""; };
        const vals = MAPPING.map((m) => pick(m.labels));

        let tKey = "";
        for (const k of ["lastUpdatedTime"]) if (s(lead[k])) { tKey = k; break; }
        timeKeyUsed[tKey || "(ingen)"] = (timeKeyUsed[tKey || "(ingen)"] ?? 0) + 1;

        let code = "";
        if (st === "success") code = "Succes";
        else if (st === "notInterested") code = "Nej tak";
        else if (st === "unqualified") code = "Ukvalificeret";
        else {
          const rf = ((Array.isArray(lead.resultData) ? lead.resultData : []) as Row[]).find((x) => Number(x.id) === INVALID_FIELD_ID);
          const rv = s(rf?.value);
          code = rv ? `Ugyldig – ${rv}` : "Max call (lukket af dialeren)";
        }
        counts[code] = (counts[code] ?? 0) + 1;
        out.push([...vals, tKey ? dkDate(s(lead[tKey])) : "", code]);
      }
      if (arr.length < PAGE_SIZE) break;
      if (page === 500) return json(502, { error: "For mange sider — afbrudt, intet gemt" });
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "Copenhagen Sales";
    const ws = wb.addWorksheet("Lukkede leads");
    const cols = [...MAPPING.map((m) => m.col), "CPH Sales lukkedato", "CPH Sales lukkekode"];
    ws.addRow(cols).font = { bold: true };
    ws.columns = cols.map(() => ({ width: 24 }));
    for (const r of out) ws.addRow(r);
    ws.views = [{ state: "frozen", ySplit: 1 }];
    const ws2 = wb.addWorksheet("Afstemning");
    ws2.addRow(["Lukkekode", "Antal"]).font = { bold: true };
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    for (const [k, n] of sorted) ws2.addRow([k, n]);
    ws2.addRow(["I alt", out.length]).font = { bold: true };
    ws2.addRow([]);
    ws2.addRow([`Kilde: Adversus main, kampagne ${CAMPAIGN_ID}, hentet ${new Date().toISOString()} (UTC)`]);
    ws2.columns = [{ width: 60 }, { width: 12 }];

    const today = new Date().toISOString().slice(0, 10);
    const fileName = `Hjerteforeningen_lukkede_leads_${today}.xlsx`;
    const buf = new Uint8Array(await wb.xlsx.writeBuffer() as ArrayBuffer);
    const up = await svc.storage.from(BUCKET).upload(fileName, buf, {
      upsert: true, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    if (up.error) return json(500, { error: "Upload fejlede" });
    const { data: signed } = await svc.storage.from(BUCKET).createSignedUrl(fileName, 300, { download: fileName });

    return json(200, {
      fileName, signedUrl: signed?.signedUrl ?? null, rows: out.length, counts,
      statusAlleLeads: statusAll, labelUdfyldt: labelFill, tidsfelt: timeKeyUsed, apiCalls,
    });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
