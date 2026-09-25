/**
 * Mailskabelon til den ugentlige mødebook-rapport (Tryg).
 *
 * Kun aggregerede tal indgår: rapportlinje, sælgernavn (vores egen medarbejder),
 * status og antal. Ingen lead-data, ingen kundeoplysninger.
 *
 * Designet følger den godkendte Copenhagen Sales ugerapport-skabelon: lys
 * baggrund, mørkt hero-kort med grøn topkant, nøgletalskort, tabeller med
 * hitrate-bjælker og en forklarende fodnote.
 */

import { escapeHtml } from "./quality-mail.ts";

const BRAND = {
  pageBg: "#eaf0f1",
  card: "#ffffff",
  dark: "#0f1115",
  darkSoft: "#1b1e24",
  text: "#111318",
  muted: "#7b8794",
  faint: "#9aa5b1",
  headerMuted: "#b9bcc4",
  cellBorder: "#e4eaec",
  track: "#e2e8ea",
  accent: "#25c26a",
};

export interface CallTotalsView {
  /** Opkaldsforsøg i perioden. */
  attempts: number;
  /** Besvarede opkald. */
  answered: number;
  /** Emner der er ringet til. */
  leadsDialed: number;
  /** Emner vi har talt med. */
  leadsAnswered: number;
}

export interface LineTotals {
  reportLine: string;
  /** Alle afsluttende statusser. */
  closed: number;
  /** Lukkede ja/nej — kun statusser der tæller i mødebook-hitraten. */
  decided: number;
  booked: number;
  /** Lukkede statusser der vises for sig og holdes ude af hitraten. */
  extras: Record<string, number>;
  /**
   * Emner dialeren selv har lukket ved max kontaktforsøg (kun Enreach markerer dem).
   * På Adversus ligger de allerede i "invalid", så mcr = 0 dér.
   */
  mcr?: number;
  /** Opkaldstal for linjen. null når kilden ikke leverer opkald. */
  calls?: CallTotalsView | null;
  /** Ugyldige pr. årsag. reason null = ingen årsag (lukket af dialeren). */
  invalidReasons?: { reason: string | null; count: number }[];
  /** adversus = årsag kan vises; enreach = Depleted-opdeling; none = ikke tilgængelig. */
  reasonSource?: "adversus" | "enreach" | "none";
}

export interface StatusTotals {
  reportLine: string;
  counts: Record<string, number>;
}

export interface SellerTotals {
  sellerName: string;
  closed: number;
  /** Lukkede ja/nej — grundlaget for sælgerens hitrate. */
  decided: number;
  booked: number;
}

export interface WeekTotals {
  weekStart: string;
  weekNumber: number;
  lines: LineTotals[];
}

export interface UnmappedCampaign {
  account: string;
  campaignId: string;
  campaignName: string | null;
  closed: number;
  booked: number;
}

export interface WeeklyLeadClosureMailInput {
  weekStart: string;
  weekNumber: number;
  lines: LineTotals[];
  statusKeys: { status: string; label: string }[];
  /** Lukkede statusser der vises som egne kolonner uden at tælle i hitraten. */
  excludedStatuses: { status: string; label: string }[];
  statusRows: StatusTotals[];
  sellers: SellerTotals[];
  previousWeeks: WeekTotals[];
  unknownStatuses: { status: string; count: number }[];
  unmapped: UnmappedCampaign[];
  /** Kampagner der fejlede i kørslen — vises nederst i mailen. */
  notScanned?: {
    account: string;
    campaignId: string;
    campaignName: string | null;
    error: string | null;
  }[];
}

export function isoWeekNumber(dateIso: string): number {
  const d = new Date(`${dateIso}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

function shortDate(dateIso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateIso}T12:00:00Z`));
}

function longDate(dateIso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateIso}T12:00:00Z`));
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekRange(weekStart: string): string {
  const end = addDays(weekStart, 6);
  return `${shortDate(weekStart).replace(".", "")} – ${longDate(end)}`;
}

function nf(value: number): string {
  return new Intl.NumberFormat("da-DK").format(value);
}

/** Procent med altid én decimal, dansk format. Deles ikke med kvalitetsmodulet. */
function pct1(part: number, whole: number): string {
  if (!whole) return "–";
  return `${((part / whole) * 100).toFixed(1).replace(".", ",")} %`;
}

function sectionTitle(title: string, subtitle: string): string {
  return `
    <div style="margin:0 0 10px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;color:${BRAND.text};text-transform:uppercase;">${escapeHtml(title)}</div>
      <div style="font-size:13px;color:${BRAND.muted};margin-top:4px;">${escapeHtml(subtitle)}</div>
    </div>`;
}

/**
 * Samme begreber og visuelle sprog som rapportsiden i Stork:
 *   Emner lukket = lukkede + dialerens max call-lukninger
 *   Kvalificerede samtaler = ja/nej (grøn boks med andel af emner lukket)
 *   Sælgerhitrate = bookede ÷ kvalificerede samtaler (bjælke + procent)
 *   Emneudnyttelse = bookede ÷ emner lukket
 * Linjer uden aktivitet udelades og nævnes i en note under tabellen.
 * Kolonnebredder er i procent, så tabellen skalerer ned på mobil.
 */
const SMALL_BASE_DECIDED = 50;
const GREEN_SOFT = "#e9f8ef";
const GREEN_TEXT = "#15994f";

function hitrateCell(booked: number, decided: number): string {
  if (!decided) return `<span style="color:${BRAND.faint};">–</span>`;
  const value = (booked / decided) * 100;
  const small = decided < SMALL_BASE_DECIDED;
  const bar = small ? BRAND.faint : BRAND.accent;
  const width = Math.max(4, Math.min(100, Math.round(value)));
  return `<div style="font-size:14px;font-weight:700;color:${small ? BRAND.muted : GREEN_TEXT};">${pct1(booked, decided)}</div>
    <div class="pd-bar" style="height:4px;background:${BRAND.track};border-radius:4px;margin:6px auto 0;width:64px;max-width:100%;overflow:hidden;">
      <div style="height:4px;width:${width}%;background:${bar};border-radius:4px;"></div>
    </div>${small ? `<div style="font-size:10px;color:${BRAND.faint};margin-top:4px;">lille grundlag</div>` : ""}`;
}

const INVALID = "invalid";
const UNQUALIFIED = "unqualified";
/** Årsag gemt for uger hentet før opdelingen, som ikke kunne genskabes. */
const NOT_SPLIT = "Ikke opgjort";

type LineView = {
  reportLine: string;
  closedTotal: number;
  unreachable: number;
  unqualified: number;
  decided: number;
  booked: number;
  source: LineTotals;
};

function viewOf(l: LineTotals): LineView & { active: boolean } {
  const mcr = l.mcr ?? 0;
  return {
    reportLine: l.reportLine,
    closedTotal: l.closed + mcr,
    unreachable: (l.extras[INVALID] ?? 0) + mcr,
    unqualified: l.extras[UNQUALIFIED] ?? 0,
    decided: l.decided,
    booked: l.booked,
    source: l,
    active: l.closed > 0 || mcr > 0 || (l.calls?.attempts ?? 0) > 0,
  };
}

const th = (text: string, width: string, align = "center") =>
  `<th class="pd-th" width="${width}" style="width:${width};word-break:break-word;text-align:${align};font-size:9px;font-weight:700;letter-spacing:1px;color:${BRAND.muted};text-transform:uppercase;padding:12px 6px 10px;line-height:1.3;">${escapeHtml(text)}</th>`;
const td = (content: string, align = "center", extra = "") =>
  `<td class="pd-td" style="text-align:${align};padding:14px 6px;word-break:break-word;border-top:1px solid ${BRAND.cellBorder};vertical-align:middle;${extra}">${content}</td>`;
const tableWrap = (inner: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;background:${BRAND.card};border:1px solid ${BRAND.cellBorder};border-radius:14px;overflow:hidden;font-variant-numeric:tabular-nums;">${inner}</table>`;

function countPct(count: number, whole: number, color: string = BRAND.text): string {
  return `<div style="font-size:14px;font-weight:600;color:${color};">${nf(count)}</div><div class="pd-sub" style="font-size:10px;color:${BRAND.muted};margin-top:2px;">${pct1(count, whole)}</div>`;
}

/** Hovedtabel: samme 8 kolonner som siden i Stork, ingen totalrække. */
function lineSection(title: string, subtitle: string, lines: LineTotals[]): string {
  const view = lines.map(viewOf);
  const active = view.filter((l) => l.active);
  const idle = view.filter((l) => !l.active);

  const head = `<thead><tr>${th("Kampagne", "19%", "left")}${th("Emner lukket", "10%")}${th("Ikke kontakt-bare", "11%")}${th("Ukvalifi-cerede", "11%")}${th("Kvalificerede samtaler", "13%")}${th("Bookede", "9%")}${th("Sælger-hitrate", "14%")}${th("Emne-udnyttelse", "13%")}</tr></thead>`;

  const row = (l: LineView) => {
    const name = `<span style="font-size:14px;font-weight:600;color:${BRAND.text};">${escapeHtml(l.reportLine)}</span>`;
    const closed = `<span style="font-size:15px;font-weight:600;color:${BRAND.text};">${nf(l.closedTotal)}</span>`;
    const qualified = `<div class="pd-pill" style="display:inline-block;background:${GREEN_SOFT};border-radius:10px;padding:6px 10px;min-width:44px;">
      <div style="font-size:15px;font-weight:700;color:${GREEN_TEXT};">${nf(l.decided)}</div>
      <div style="font-size:10px;color:${GREEN_TEXT};margin-top:2px;">${pct1(l.decided, l.closedTotal)}</div></div>`;
    const booked = `<span style="font-size:14px;color:${BRAND.text};font-weight:500;">${nf(l.booked)}</span>`;
    const usage = `<span style="font-size:15px;font-weight:800;color:${BRAND.text};">${pct1(l.booked, l.closedTotal)}</span>`;
    return `<tr>${td(name, "left", "padding-left:14px;")}${td(closed)}${td(countPct(l.unreachable, l.closedTotal))}${td(countPct(l.unqualified, l.closedTotal))}${td(qualified)}${td(booked)}${td(hitrateCell(l.booked, l.decided))}${td(usage, "center", "padding-right:14px;")}</tr>`;
  };

  const rows = active.map(row).join("");
  const body = rows
    ? `<tbody>${rows}</tbody>`
    : `<tbody><tr><td colspan="8" style="padding:16px;font-size:13px;color:${BRAND.faint};">Ingen lukkede emner i perioden.</td></tr></tbody>`;
  const note = idle.length
    ? `<div style="font-size:12px;color:${BRAND.muted};margin:8px 0 0;">${idle.length} ${
      idle.length === 1 ? "kampagne" : "kampagner"
    } uden aktivitet: ${escapeHtml(idle.map((l) => l.reportLine).join(", "))}</div>`
    : "";
  return `<div style="margin:0 0 28px;">${sectionTitle(title, subtitle)}${tableWrap(head + body)}${note}</div>`;
}

/** Opdeling af Ikke kontaktbare for én kampagne — samme som detaljerne i Stork. */
function unreachableBreakdown(l: LineView): string {
  const line = (label: string, count: number, whole: number, indent = false, strong = false) =>
    `<tr><td style="padding:5px ${indent ? "0 5px 22px" : "0 5px 0"};font-size:13px;color:${indent ? BRAND.muted : BRAND.text};font-weight:${strong ? 700 : 400};">${escapeHtml(label)}</td><td align="right" style="padding:5px 0;font-size:13px;color:${BRAND.text};font-weight:${strong ? 700 : 500};white-space:nowrap;">${nf(count)} <span style="color:${BRAND.muted};font-weight:400;">· ${pct1(count, whole)}</span></td></tr>`;
  const source = l.source.reasonSource ?? "none";
  const total = l.unreachable;
  let rows = line("Ikke kontaktbare", total, l.closedTotal, false, true);
  if (source === "enreach") {
    const mcr = l.source.mcr ?? 0;
    rows += line("Max call (lukket af dialeren)", mcr, total, true);
    rows += line("Ugyldig", total - mcr, total, true);
  } else if (source === "adversus") {
    const reasons = l.source.invalidReasons ?? [];
    const marked = reasons.filter((r) => r.reason && r.reason !== NOT_SPLIT).sort((a, b) => b.count - a.count);
    const markedTotal = marked.reduce((s, r) => s + r.count, 0);
    const notSplit = reasons.filter((r) => r.reason === NOT_SPLIT).reduce((s, r) => s + r.count, 0);
    rows += line("Sælgermarkeret ugyldig", markedTotal, total);
    for (const r of marked) rows += line(r.reason as string, r.count, markedTotal, true);
    rows += line("Lukket af dialeren (max kontaktforsøg eller dødt nummer)", total - markedTotal - notSplit, total);
    if (notSplit) rows += line("Ikke opgjort (hentet før opdelingen)", notSplit, total);
  } else {
    rows += `<tr><td colspan="2" style="padding:5px 0 5px 22px;font-size:12px;color:${BRAND.muted};">Årsag ikke tilgængelig for denne kampagne</td></tr>`;
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;">${rows}</table>`;
}

function specifiedSection(weekNumber: number, lines: LineTotals[]): string {
  const active = lines.map(viewOf).filter((l) => l.active);
  if (!active.length) return "";
  const kpi = (label: string, value: string) =>
    `<td class="pd-td" width="20%" style="width:20%;padding:8px 4px;text-align:center;vertical-align:top;"><div style="font-size:9px;font-weight:700;letter-spacing:1px;color:${BRAND.muted};text-transform:uppercase;">${escapeHtml(label)}</div><div style="font-size:14px;font-weight:700;color:${BRAND.text};margin-top:4px;">${value}</div></td>`;
  const blocks = active.map((l) => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:separate;background:${BRAND.card};border:1px solid ${BRAND.cellBorder};border-radius:14px;margin:0 0 14px;">
      <tr><td style="padding:14px 16px 6px;font-size:15px;font-weight:800;color:${BRAND.text};">${escapeHtml(l.reportLine)} <span style="font-size:12px;font-weight:400;color:${BRAND.muted};">· ${nf(l.closedTotal)} emner lukket</span></td></tr>
      <tr><td style="padding:4px 16px 8px;">${unreachableBreakdown(l)}</td></tr>
      <tr><td style="padding:0 10px 10px;border-top:1px solid ${BRAND.cellBorder};">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;table-layout:fixed;"><tr>
          ${kpi("Ukvalificerede", `${nf(l.unqualified)} <span style="font-size:11px;font-weight:400;color:${BRAND.muted};">${pct1(l.unqualified, l.closedTotal)}</span>`)}
          ${kpi("Kvalificerede samtaler", `<span style="color:${GREEN_TEXT};">${nf(l.decided)}</span> <span style="font-size:11px;font-weight:400;color:${BRAND.muted};">${pct1(l.decided, l.closedTotal)}</span>`)}
          ${kpi("Bookede", nf(l.booked))}
          ${kpi("Sælgerhitrate", pct1(l.booked, l.decided))}
          ${kpi("Emneudnyttelse", pct1(l.booked, l.closedTotal))}
        </tr></table>
      </td></tr>
    </table>`).join("");
  const definition = `<div style="font-size:12px;color:${BRAND.muted};line-height:1.6;margin:4px 0 0;"><strong style="color:${BRAND.text};">Sælgermarkeret ugyldig:</strong> sælgeren har talt med eller afklaret emnet og markeret det ugyldigt med en årsag. <strong style="color:${BRAND.text};">Lukket af dialeren:</strong> emnet blev lukket automatisk uden kontakt – ved max kontaktforsøg eller fordi nummeret ikke virker.</div>`;
  return `<div style="margin:0 0 28px;">${sectionTitle("Specificeret pr. kampagne", `Uge ${weekNumber} · opdeling af ikke kontaktbare`)}${blocks}${definition}</div>`;
}

export function buildWeeklyLeadClosureMail(input: WeeklyLeadClosureMailInput): {
  subject: string;
  html: string;
} {
  const subject = `Kampagneoversigt Tryg — uge ${input.weekNumber}`;


  const table1 = lineSection(
    "Resultater pr. kampagne",
    `Uge ${input.weekNumber}`,
    input.lines,
  );

  // Tabel 2 (status pr. rapportlinje) og tabel 3 (pr. sælger) vises ikke i mailen efter ønske —
  // tallene findes stadig på rapportsiden.



  const table4 = input.previousWeeks.length
    ? input.previousWeeks
        .map((w) =>
          lineSection(
            `Uge ${w.weekNumber}`,
            weekRange(w.weekStart),
            w.lines,
          ),
        )
        .join("")
    : "";

  const notes: string[] = [];
  if (input.unmapped.length) {
    notes.push(
      `<strong>Ikke mappet:</strong> ${input.unmapped
        .map(
          (u) =>
            `${escapeHtml(u.campaignName ?? u.campaignId)} (${escapeHtml(u.account)}/${escapeHtml(u.campaignId)}): ${nf(u.closed)} lukkede, ${nf(u.booked)} bookede`,
        )
        .join("; ")}`,
    );
  }
  if (input.unknownStatuses.length) {
    notes.push(
      `<strong>Ukendte statusser:</strong> ${input.unknownStatuses
        .map((s) => `${escapeHtml(s.status)} (${nf(s.count)})`)
        .join(", ")} — tilføj dem i statusopsætningen, hvis de skal tælle som lukkede.`,
    );
  }
  // Fejlede kampagner nævnes eksplicit, så tabellen aldrig ser komplet ud,
  // når den ikke er.
  if (input.notScanned?.length) {
    notes.push(
      `<strong>Ikke scannet:</strong> ${input.notScanned
        .map(
          (u) =>
            `${escapeHtml(u.campaignName ?? u.campaignId)} (${escapeHtml(u.account)}/${escapeHtml(u.campaignId)}): ${escapeHtml(u.error ?? "ukendt fejl")}`,
        )
        .join("; ")} — tallene herunder mangler disse kampagner.`,
    );
  }
  const notesHtml = notes.length
    ? `<div style="background:${BRAND.card};border:1px solid ${BRAND.cellBorder};border-radius:12px;padding:18px 20px;font-size:13px;color:${BRAND.text};line-height:1.65;margin:0 0 20px;">${notes
        .map((n) => `<p style="margin:0 0 8px;">${n}</p>`)
        .join("")}</div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="da"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(subject)}</title>
<style>
  @media only screen and (max-width:600px) {
    .pd-wrap { padding:14px 8px !important; }
    .pd-hero td { padding:20px 18px 22px !important; }
    .pd-hero-title { font-size:22px !important; }
    .pd-th { font-size:9px !important; letter-spacing:0 !important; text-transform:none !important; word-break:normal !important; padding:10px 3px 8px !important; }
    .pd-td { padding:12px 3px !important; }
    .pd-td span, .pd-td div { font-size:12px !important; }
    .pd-pill { padding:4px 5px !important; min-width:0 !important; }
    .pd-pill div + div, .pd-bar, .pd-sub { display:none !important; }
  }
</style></head>
<body class="pd-wrap" style="margin:0;padding:26px 14px;background:${BRAND.pageBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:760px;margin:0 auto;">

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="pd-hero" style="border-collapse:collapse;background:${BRAND.dark};border-top:4px solid ${BRAND.accent};border-radius:16px;overflow:hidden;margin:0 0 26px;">
      <tr><td style="padding:26px 28px 30px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="font-size:13px;font-weight:800;letter-spacing:2px;color:#ffffff;text-transform:uppercase;">
              <span style="display:inline-block;background:${BRAND.accent};color:${BRAND.dark};font-size:12px;font-weight:800;letter-spacing:0;padding:6px 8px;border-radius:7px;margin-right:10px;">CS</span>Copenhagen Sales
            </td>
            <td align="right" style="font-size:12px;color:${BRAND.headerMuted};">Ugerapport · Uge ${input.weekNumber}</td>
          </tr>
        </table>
        <div class="pd-hero-title" style="font-size:28px;font-weight:800;color:#ffffff;margin-top:24px;line-height:1.2;">Kampagneoversigt Tryg</div>
        <div style="font-size:13px;color:${BRAND.headerMuted};margin-top:10px;">${escapeHtml(weekRange(input.weekStart))} · resultater pr. kampagne</div>
      </td></tr>
    </table>

    <div style="font-size:15px;color:${BRAND.text};line-height:1.7;margin:0 0 26px;">
      Her er ugens tal for mødebooking på Tryg pr. kampagne.
    </div>

    ${table1}${table4}${specifiedSection(input.weekNumber, input.lines)}${notesHtml}


    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;padding:0;">
      <tr>
        <td style="font-size:12px;color:${BRAND.text};line-height:1.7;">
          <strong>Copenhagen Sales ApS</strong><br />
          <span style="color:${BRAND.muted};">Vesterbrogade 149 · 1620 København V</span>
        </td>
        <td align="right" style="font-size:12px;color:${BRAND.muted};line-height:1.7;">
          Rapporten sendes hver mandag kl. 07.00.
        </td>
      </tr>
    </table>

  </div>
</body></html>`;

  return { subject, html };
}
