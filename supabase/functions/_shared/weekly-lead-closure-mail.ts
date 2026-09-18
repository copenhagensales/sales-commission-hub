/**
 * Mailskabelon til den ugentlige mødebook-rapport (Tryg).
 *
 * Kun aggregerede tal indgår: rapportlinje, sælgernavn (vores egen medarbejder),
 * status og antal. Ingen lead-data, ingen kundeoplysninger.
 *
 * Designet følger det godkendte Copenhagen Sales mail-design, som
 * kvalitetsmodulets mails bruger.
 */

import { escapeHtml, pct } from "./quality-mail.ts";

const BRAND = {
  pageBg: "#e6eff1",
  card: "#ffffff",
  header: "#26262a",
  text: "#111318",
  muted: "#7b8794",
  headerMuted: "#b9bcc4",
  cellBg: "#f4f8f9",
  cellBorder: "#e2eaec",
};

export interface LineTotals {
  reportLine: string;
  /** Alle afsluttende statusser. */
  closed: number;
  /** Lukkede ja/nej — kun statusser der tæller i mødebook-hitraten. */
  decided: number;
  booked: number;
  /** Lukkede statusser der vises for sig og holdes ude af hitraten. */
  extras: Record<string, number>;
}

export interface StatusTotals {
  reportLine: string;
  counts: Record<string, number>;
}

export interface SellerTotals {
  sellerName: string;
  closed: number;
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

function th(text: string, align = "left"): string {
  return `<th style="text-align:${align};font-size:12px;font-weight:700;letter-spacing:0.4px;color:${BRAND.muted};text-transform:uppercase;padding:8px 10px;border-bottom:1px solid ${BRAND.cellBorder};">${escapeHtml(text)}</th>`;
}

function td(text: string, align = "left", bold = false): string {
  return `<td style="text-align:${align};font-size:14px;color:${BRAND.text};padding:8px 10px;border-bottom:1px solid ${BRAND.cellBorder};${bold ? "font-weight:700;" : ""}">${escapeHtml(text)}</td>`;
}

function section(title: string, subtitle: string, tableHtml: string): string {
  return `
    <div style="margin:0 0 28px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1.6px;color:${BRAND.muted};text-transform:uppercase;margin:0 0 4px;">${escapeHtml(title)}</div>
      <div style="font-size:13px;color:${BRAND.muted};margin:0 0 10px;">${escapeHtml(subtitle)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:${BRAND.cellBg};border:1px solid ${BRAND.cellBorder};border-radius:8px;">
        ${tableHtml}
      </table>
    </div>`;
}

function lineTable(lines: LineTotals[], excluded: { status: string; label: string }[]): string {
  const totalClosed = lines.reduce((s, l) => s + l.closed, 0);
  const totalDecided = lines.reduce((s, l) => s + l.decided, 0);
  const totalBooked = lines.reduce((s, l) => s + l.booked, 0);
  const rows = lines
    .map(
      (l) =>
        `<tr>${td(l.reportLine)}${td(String(l.closed), "right")}${td(String(l.decided), "right")}${td(String(l.booked), "right")}${td(pct(l.booked, l.decided), "right")}${excluded
          .map((e) => td(String(l.extras[e.status] ?? 0), "right"))
          .join("")}</tr>`,
    )
    .join("");
  const totalExtras = excluded
    .map((e) =>
      td(String(lines.reduce((s, l) => s + (l.extras[e.status] ?? 0), 0)), "right", true),
    )
    .join("");
  return `
    <thead><tr>${th("Rapportlinje")}${th("Antal lukkede emner", "right")}${th("Lukkede ja/nej", "right")}${th("Antal bookede møder", "right")}${th("Mødebook hitrate", "right")}${excluded
      .map((e) => th(e.label, "right"))
      .join("")}</tr></thead>
    <tbody>${rows}
      <tr>${td("Tryg i alt", "left", true)}${td(String(totalClosed), "right", true)}${td(String(totalDecided), "right", true)}${td(String(totalBooked), "right", true)}${td(pct(totalBooked, totalDecided), "right", true)}${totalExtras}</tr>
    </tbody>`;
}

export function buildWeeklyLeadClosureMail(input: WeeklyLeadClosureMailInput): {
  subject: string;
  html: string;
} {
  const subject = `Mødebook-rapport Tryg — uge ${input.weekNumber}`;

  const table1 = section(
    "Tabel 1 — Trygs skabelon",
    `Uge ${input.weekNumber} (${shortDate(input.weekStart)} – søndag)`,
    lineTable(input.lines),
  );

  const statusHead = `<thead><tr>${th("Rapportlinje")}${input.statusKeys
    .map((s) => th(s.label, "right"))
    .join("")}</tr></thead>`;
  const statusBody = input.statusRows
    .map(
      (r) =>
        `<tr>${td(r.reportLine)}${input.statusKeys
          .map((s) => td(String(r.counts[s.status] ?? 0), "right"))
          .join("")}</tr>`,
    )
    .join("");
  const table2 = section(
    "Tabel 2 — status pr. rapportlinje",
    "Antal afsluttede emner fordelt på Adversus-status",
    `${statusHead}<tbody>${statusBody}</tbody>`,
  );

  const sellerRows = input.sellers
    .map(
      (s) =>
        `<tr>${td(s.sellerName)}${td(String(s.closed), "right")}${td(String(s.booked), "right")}${td(pct(s.booked, s.closed), "right")}</tr>`,
    )
    .join("");
  const table3 = section(
    "Tabel 3 — pr. sælger",
    `Uge ${input.weekNumber}`,
    `<thead><tr>${th("Sælger")}${th("Lukkede", "right")}${th("Bookede", "right")}${th("Hitrate", "right")}</tr></thead><tbody>${sellerRows}</tbody>`,
  );

  const table4 = input.previousWeeks.length
    ? input.previousWeeks
        .map((w) =>
          section(
            `Tabel 4 — uge ${w.weekNumber}`,
            `${shortDate(w.weekStart)} – søndag`,
            lineTable(w.lines),
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
            `${escapeHtml(u.campaignName ?? u.campaignId)} (${escapeHtml(u.account)}/${escapeHtml(u.campaignId)}): ${u.closed} lukkede, ${u.booked} bookede`,
        )
        .join("; ")}`,
    );
  }
  if (input.unknownStatuses.length) {
    notes.push(
      `<strong>Ukendte statusser:</strong> ${input.unknownStatuses
        .map((s) => `${escapeHtml(s.status)} (${s.count})`)
        .join(", ")} — tilføj dem i statusopsætningen, hvis de skal tælle som lukkede.`,
    );
  }
  const notesHtml = notes.length
    ? `<div style="font-size:13px;color:${BRAND.muted};line-height:1.6;border-top:1px solid ${BRAND.cellBorder};padding-top:14px;">${notes
        .map((n) => `<p style="margin:0 0 8px;">${n}</p>`)
        .join("")}</div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="da"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:24px;background:${BRAND.pageBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:760px;margin:0 auto;width:100%;background:${BRAND.card};border-radius:14px;overflow:hidden;">
    <tr><td style="background:${BRAND.header};padding:22px 26px;">
      <div style="font-size:18px;font-weight:700;color:#ffffff;">Mødebook-rapport — Tryg</div>
      <div style="font-size:13px;color:${BRAND.headerMuted};margin-top:4px;">Uge ${input.weekNumber} · lukkede emner, bookede møder og hitrate</div>
    </td></tr>
    <tr><td style="padding:26px;">
      ${table1}${table2}${table3}${table4}${notesHtml}
    </td></tr>
  </table>
</body></html>`;

  return { subject, html };
}
