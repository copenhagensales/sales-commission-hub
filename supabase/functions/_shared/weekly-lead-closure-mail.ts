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

/** Frasorteret vises som andel af lukkede med antallet i parentes. */
function sharePlusCount(count: number, whole: number): string {
  if (!whole) return `${nf(count)} stk`;
  return `${pct1(count, whole)} (${nf(count)} stk)`;
}




function th(text: string, align = "left"): string {
  return `<th style="text-align:${align};font-size:10px;font-weight:700;letter-spacing:1.2px;color:${BRAND.muted};text-transform:uppercase;padding:14px 12px;border-bottom:1px solid ${BRAND.cellBorder};white-space:nowrap;">${escapeHtml(text)}</th>`;
}

function td(
  text: string,
  align = "left",
  opts: { bold?: boolean; dim?: boolean; accent?: boolean; onDark?: boolean } = {},
): string {
  const color = opts.onDark
    ? opts.accent
      ? BRAND.accent
      : "#ffffff"
    : opts.dim
      ? BRAND.faint
      : opts.accent
        ? BRAND.accent
        : BRAND.text;
  const border = opts.onDark ? "none" : `1px solid ${BRAND.cellBorder}`;
  return `<td style="text-align:${align};font-size:14px;color:${color};padding:14px 12px;border-bottom:${border};font-weight:${opts.bold ? 700 : 500};white-space:nowrap;">${escapeHtml(text)}</td>`;
}

/** Gruppeoverskrift over flere kolonner. */
function groupTh(text: string, span: number, align = "center"): string {
  const label = text
    ? `<span style="display:inline-block;background:${BRAND.pageBg};color:${BRAND.muted};font-size:9px;font-weight:800;letter-spacing:1.2px;padding:4px 8px;border-radius:6px;text-transform:uppercase;">${escapeHtml(text)}</span>`
    : "&nbsp;";
  return `<th colspan="${span}" style="text-align:${align};padding:12px 12px 0;font-weight:400;">${label}</th>`;
}


function sectionTitle(title: string, subtitle: string): string {
  return `
    <div style="margin:0 0 10px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;color:${BRAND.text};text-transform:uppercase;">${escapeHtml(title)}</div>
      <div style="font-size:13px;color:${BRAND.muted};margin-top:4px;">${escapeHtml(subtitle)}</div>
    </div>`;
}

function card(tableHtml: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;background:${BRAND.card};border:1px solid ${BRAND.cellBorder};border-radius:12px;overflow:hidden;">${tableHtml}</table>`;
}

function section(title: string, subtitle: string, tableHtml: string): string {
  return `<div style="margin:0 0 30px;">${sectionTitle(title, subtitle)}${card(tableHtml)}</div>`;
}


/**
 * Samme kolonner og begreber som rapportsiden i Stork, så kunden ser ét begreb
 * på tværs af Adversus og Enreach:
 *   Emner lukket = lukkede + dialerens max call-lukninger
 *   Ikke kontaktbare = ugyldige + max call (Adversus har max call i ugyldige)
 *   Sælgerhitrate = bookede ÷ kvalificerede samtaler
 *   Emneudnyttelse = bookede ÷ emner lukket
 * Linjer uden aktivitet udelades og nævnes i en note under tabellen.
 */
const INVALID_STATUS = "invalid";
const UNQUALIFIED_STATUS = "unqualified";

function countPct(count: number, whole: number): string {
  return whole > 0 ? `${nf(count)} (${pct1(count, whole)})` : nf(count);
}

function lineSection(title: string, subtitle: string, lines: LineTotals[]): string {
  const view = lines.map((l) => {
    const mcr = l.mcr ?? 0;
    return {
      reportLine: l.reportLine,
      closedTotal: l.closed + mcr,
      unreachable: (l.extras[INVALID_STATUS] ?? 0) + mcr,
      unqualified: l.extras[UNQUALIFIED_STATUS] ?? 0,
      decided: l.decided,
      booked: l.booked,
      active: l.closed > 0 || mcr > 0 || (l.calls?.attempts ?? 0) > 0,
    };
  });
  const active = view.filter((l) => l.active);
  const idle = view.filter((l) => !l.active);
  const total = (pick: (l: (typeof view)[number]) => number) => active.reduce((s, l) => s + pick(l), 0);
  const t = {
    closedTotal: total((l) => l.closedTotal),
    unreachable: total((l) => l.unreachable),
    unqualified: total((l) => l.unqualified),
    decided: total((l) => l.decided),
    booked: total((l) => l.booked),
  };

  const head = `<thead>
    <tr>${groupTh("", 2, "left")}${groupTh("Frasorteret", 2)}${groupTh("", 2)}${groupTh("Sælger", 1)}${groupTh("Kampagne", 1)}</tr>
    <tr>${th("Kampagne")}${th("Emner lukket", "right")}${th("Ikke kontaktbare", "right")}${th("Ukvalificerede", "right")}${th("Kvalificerede samtaler", "right")}${th("Bookede", "right")}${th("Sælgerhitrate", "right")}${th("Emneudnyttelse", "right")}</tr>
  </thead>`;

  const row = (l: typeof t & { reportLine: string }, dark: boolean) => {
    const o = dark ? { onDark: true } : {};
    return `<tr${dark ? ` style="background:${BRAND.dark};"` : ""}>${td(l.reportLine, "left", { bold: true, ...o })}${td(
      nf(l.closedTotal),
      "right",
      { bold: dark, ...o },
    )}${td(countPct(l.unreachable, l.closedTotal), "right", o)}${td(countPct(l.unqualified, l.closedTotal), "right", o)}${td(
      countPct(l.decided, l.closedTotal),
      "right",
      o,
    )}${td(nf(l.booked), "right", o)}${td(pct1(l.booked, l.decided), "right", o)}${td(
      pct1(l.booked, l.closedTotal),
      "right",
      { bold: true, accent: true, ...o },
    )}</tr>`;
  };

  const rows = active.map((l) => row(l, false)).join("");
  const body = rows
    ? `<tbody>${rows}${row({ reportLine: "Tryg i alt", ...t }, true)}</tbody>`
    : `<tbody><tr>${td("Ingen lukkede emner i perioden.", "left", { dim: true })}</tr></tbody>`;

  const note = idle.length
    ? `<div style="font-size:12px;color:${BRAND.muted};margin:8px 0 0;">${idle.length} ${
      idle.length === 1 ? "kampagne" : "kampagner"
    } uden aktivitet: ${escapeHtml(idle.map((l) => l.reportLine).join(", "))}</div>`
    : "";

  return `<div style="margin:0 0 30px;">${sectionTitle(title, subtitle)}${card(`${head}${body}`)}${note}</div>`;
}


export function buildWeeklyLeadClosureMail(input: WeeklyLeadClosureMailInput): {
  subject: string;
  html: string;
} {
  const subject = `Kampagneoversigt Tryg — uge ${input.weekNumber}`;


  const table1 = lineSection(
    "Tabel 1 — Trygs skabelon",
    `Pr. kampagne, uge ${input.weekNumber}.`,
    input.lines,
  );

  // Tabel 2 (status pr. rapportlinje) og tabel 3 (pr. sælger) vises ikke i mailen efter ønske —
  // tallene findes stadig på rapportsiden.



  const table4 = input.previousWeeks.length
    ? input.previousWeeks
        .map((w) =>
          lineSection(
            `Tabel 4 — uge ${w.weekNumber}`,
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
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:26px 14px;background:${BRAND.pageBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:760px;margin:0 auto;">

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${BRAND.dark};border-top:4px solid ${BRAND.accent};border-radius:16px;overflow:hidden;margin:0 0 26px;">
      <tr><td style="padding:26px 28px 30px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="font-size:13px;font-weight:800;letter-spacing:2px;color:#ffffff;text-transform:uppercase;">
              <span style="display:inline-block;background:${BRAND.accent};color:${BRAND.dark};font-size:12px;font-weight:800;letter-spacing:0;padding:6px 8px;border-radius:7px;margin-right:10px;">CS</span>Copenhagen Sales
            </td>
            <td align="right" style="font-size:12px;color:${BRAND.headerMuted};">Ugerapport · Uge ${input.weekNumber}</td>
          </tr>
        </table>
        <div style="font-size:28px;font-weight:800;color:#ffffff;margin-top:24px;line-height:1.2;">Kampagneoversigt Tryg</div>
        <div style="font-size:13px;color:${BRAND.headerMuted};margin-top:10px;">${escapeHtml(weekRange(input.weekStart))} · lukkede emner, bookede møder og hitrate</div>
      </td></tr>
    </table>

    <div style="font-size:15px;color:${BRAND.text};line-height:1.7;margin:0 0 26px;">
      Her er ugens tal for mødebooking på Tryg pr. kampagne.
      Skriv endelig, hvis I vil have en anden opdeling.
    </div>

    ${table1}${table4}${notesHtml}

    <div style="background:${BRAND.card};border:1px solid ${BRAND.cellBorder};border-radius:12px;padding:18px 20px;margin:0 0 18px;">
      <div style="font-size:10px;font-weight:800;letter-spacing:1.4px;color:${BRAND.muted};text-transform:uppercase;margin:0 0 10px;">Sådan læses tallene</div>
      <div style="font-size:13px;color:${BRAND.text};line-height:1.7;">
        <strong>Emner lukket</strong> er alle emner afsluttet i ugen – af en sælger eller af dialeren.
        <strong>Ikke kontaktbare</strong> er forkerte numre, allerede kunder og emner lukket ved max kontaktforsøg.
        <strong>Ukvalificerede</strong> er emner der ikke opfyldte kriterierne for et møde.
        <strong>Sælgerhitrate</strong> er bookede møder i procent af kvalificerede samtaler.
        <strong>Emneudnyttelse</strong> er bookede møder i procent af alle lukkede emner – hvad kampagnen får ud af de leverede leads.
      </div>
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;padding:0;">
      <tr>
        <td style="font-size:12px;color:${BRAND.text};line-height:1.7;">
          <strong>Copenhagen Sales ApS</strong><br />
          <span style="color:${BRAND.muted};">Vesterbrogade 149 · 1620 København V</span>
        </td>
        <td align="right" style="font-size:12px;color:${BRAND.muted};line-height:1.7;">
          Rapporten sendes hver mandag kl. 07.00.<br />Spørgsmål? Svar blot på denne mail.
        </td>
      </tr>
    </table>

  </div>
</body></html>`;

  return { subject, html };
}
