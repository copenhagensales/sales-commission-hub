/**
 * Intern mail "Leveringsstatus Tryg": flow-balance pr. rapportlinje.
 * Kun antal pr. kampagne — ingen lead-data, ingen sælgernavne, ingen totaler på tværs.
 */
import { escapeHtml } from "./quality-mail.ts";

export type TrygFlowMailLine = {
  line: string;
  /** null = Modtaget kan ikke opgøres for linjen (fx Enreach). */
  received: number | null;
  closed: number;
  diff: number | null;
  pool: number | null;
  /** Difference for de seneste 4 uger (ældste først). */
  trend: (number | null)[];
};

const num = (n: number | null) => (n === null ? "–" : n.toLocaleString("da-DK"));
const signed = (n: number | null) => (n === null ? "–" : `${n > 0 ? "+" : ""}${n.toLocaleString("da-DK")}`);
const color = (n: number | null) => (n === null ? "#7b8794" : n > 0 ? "#c0392b" : "#1e8449");

export function buildTrygFlowMailSection(input: {
  weekNumber: number;
  trendWeeks: number[];
  lines: TrygFlowMailLine[];
}): string {
  const th = (t: string) =>
    `<th style="text-align:right;padding:8px 6px;font-size:11px;color:#7b8794;text-transform:uppercase;border-bottom:1px solid #e4eaec;">${t}</th>`;
  const td = (v: string, c = "#111318") =>
    `<td style="text-align:right;padding:8px 6px;font-size:13px;color:${c};border-bottom:1px solid #e4eaec;">${v}</td>`;
  const rows = input.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 6px;font-size:13px;font-weight:600;border-bottom:1px solid #e4eaec;">${escapeHtml(l.line)}</td>${td(num(l.received))}${td(num(l.closed))}${td(signed(l.diff), color(l.diff))}${td(signed(l.pool), color(l.pool))}${l.trend.map((t) => td(signed(t), color(t))).join("")}</tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html lang="da"><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px 14px;background:#eaf0f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:12px;padding:22px;">
<div style="font-size:20px;font-weight:800;color:#111318;">Leveringsstatus Tryg – uge ${input.weekNumber}</div>
<div style="font-size:13px;color:#7b8794;margin:6px 0 16px;">Intern – sendes ikke til kunden. Difference = Modtaget − Lukket (mål ≤ 0). Pulje = akkumuleret difference (positiv = vi sakker bagud).</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
<tr><th style="text-align:left;padding:8px 6px;font-size:11px;color:#7b8794;text-transform:uppercase;border-bottom:1px solid #e4eaec;">Kampagne</th>${th("Modtaget")}${th("Lukket")}${th("Difference")}${th("Pulje")}${input.trendWeeks.map((w) => th(`Diff. uge ${w}`)).join("")}</tr>
${rows}
</table>
<div style="font-size:12px;color:#7b8794;margin-top:14px;line-height:1.6;">Modtaget = emner oprettet på kampagnen i ugen (man–søn). Lukket = Tryg-rapportens lukkede emner i ugen, uanset hvornår de er modtaget. "–" = Modtaget kan ikke opgøres for linjen endnu. Afstemningen mod Trygs tal har kendte afvigelser.</div>
</div></body></html>`;
}
