/**
 * Mailskabelon til ugens faste forloeb (1-1 coaching / 1-1 lyt).
 *
 * Skabelonen er ren praesentation: den modtager de tal serveren i forvejen
 * har slaaet op i `ramp_session_recipients` og lederens egne felter.
 * Ingen forretningsregler, ingen autogenereret vurdering af saelgeren.
 */

const C = {
  bg: "#e6f0f1",
  onyx: "#2e3136",
  emerald: "#3BE086",
  emeraldSoft: "#8fd9b4",
  neutral: "#b9c2c6",
  white: "#ffffff",
  soft: "#f2f7f8",
  softBorder: "#dce6e7",
  muted: "#5b6169",
  green: "#10794b",
  onEmerald: "#14352a",
  light: "#e6f0f1",
};

const FONT = "'Figtree',Arial,Helvetica,sans-serif";
const APP_URL = "https://stork.copenhagensales.dk";

export type SessionKind = "coaching" | "listen";

export const KIND_LABEL: Record<SessionKind, string> = {
  coaching: "1-1 coaching",
  listen: "1-1 lyt",
};

export interface WeekPoint {
  iso_week: number;
  sales: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
}

export interface SessionMailInput {
  kind: SessionKind;
  sellerName: string;
  leaderName: string;
  campaignName: string | null;
  dayNo: number | null;
  isoWeek: number;
  note: string;
  focusArea: string | null;
  focusNote: string | null;
  strengthNote: string | null;
  weeks: WeekPoint[];
  bandLow: number | null;
  bandMedian: number | null;
  bandHigh: number | null;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

function initials(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
}

function txt(size: number, lh: number, color: string, weight = 400): string {
  return `font-family:${FONT};font-size:${size}px;line-height:${lh}px;mso-line-height-rule:exactly;font-weight:${weight};color:${color};`;
}

function label(color = C.muted): string {
  return `font-family:${FONT};font-size:11px;font-weight:800;letter-spacing:1.6px;color:${color};`;
}

/** Soejlegraf bygget af tabelceller. Fuld emerald bruges kun paa uger i spaendet. */
function chart(input: SessionMailInput): string {
  const weeks = input.weeks.slice(-6);
  if (weeks.length === 0) return "";

  const low = input.bandLow;
  const max = Math.max(1, ...weeks.map((w) => w.sales), low ?? 0);
  const width = (100 / weeks.length).toFixed(2);

  const barCell = (w: WeekPoint, last: boolean) => {
    const h = Math.max(3, Math.round((w.sales / max) * 56));
    const color = low === null
      ? C.emeraldSoft
      : w.sales >= low
        ? C.emerald
        : w.sales >= low - 3
          ? C.emeraldSoft
          : C.neutral;
    return `<td width="${width}%" valign="bottom" style="${last ? "" : "padding-right:6px;"}">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td height="${h}" bgcolor="${color}" style="border-radius:6px 6px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
      </table></td>`;
  };

  const valueCell = (w: WeekPoint, i: number) =>
    `<td width="${width}%" align="center" style="${txt(13, 18, i === weeks.length - 1 ? C.emerald : C.white, 800)}padding-top:8px;">${w.sales}</td>`;

  const weekCell = (w: WeekPoint, i: number) =>
    `<td width="${width}%" align="center" style="${txt(10, 14, i === weeks.length - 1 ? C.emerald : "#9aa5aa", 800)}padding-top:3px;">u${w.iso_week}</td>`;

  const first = weeks[0].sales;
  const last = weeks[weeks.length - 1].sales;
  const diff = last - first;
  const trend = diff > 0
    ? `&uarr; op ${diff} salg`
    : diff < 0
      ? `ned ${Math.abs(diff)} salg`
      : "samme niveau";

  const bandLine = low !== null
    ? `<tr>
        <td height="0" style="border-top:2px dashed ${C.emeraldSoft};height:0;font-size:0;line-height:0;padding:0;"></td>
        <td width="96" height="0" style="height:0;font-size:0;line-height:0;padding:0;"></td>
      </tr>`
    : "";

  const bandLabel = low !== null
    ? `<td width="96" valign="bottom" align="right" style="font-family:${FONT};font-size:10px;font-weight:800;color:${C.green};padding-left:8px;white-space:nowrap;">${low} = SPÆNDET</td>`
    : `<td width="96">&nbsp;</td>`;

  const footer = low !== null && input.bandMedian !== null
    ? `Typisk spænd for din anciennitet: ${low}&ndash;${input.bandHigh ?? input.bandMedian} salg &middot; median ${input.bandMedian}.`
    : "";

  return `<tr><td style="padding:22px 30px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.soft};border:1px solid ${C.softBorder};border-radius:18px;">
      <tr><td style="padding:20px 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="${label()}padding-bottom:8px;">SALG PR. UGE</td>
            <td align="right" style="${label()}padding-bottom:8px;">SIDEN UGE ${weeks[0].iso_week}</td>
          </tr>
          <tr>
            <td style="${txt(27, 32, C.onyx, 800)}">${first} &rarr; ${last}</td>
            <td align="right" style="${txt(15, 20, C.green, 800)}">${trend}</td>
          </tr>
          <tr><td colspan="2" style="padding-top:14px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${weeks.map((w, i) => barCell(w, i === weeks.length - 1)).join("")}</tr></table></td>
                ${bandLabel}
              </tr>
              ${bandLine}
              <tr>
                <td><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${weeks.map(weekCell).join("")}</tr></table></td>
                <td width="96">&nbsp;</td>
              </tr>
            </table>
          </td></tr>
          ${footer ? `<tr><td colspan="2" style="${txt(12, 19, C.muted)}padding-top:14px;">${footer}</td></tr>` : ""}
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

function quoteBlock(note: string, focus: string | null): string {
  const body = esc(note).replace(/\n/g, "<br>");
  const focusBox = focus
    ? `<tr><td height="12" style="font-size:0;line-height:0;">&nbsp;</td></tr>
       <tr><td style="background:${C.emerald};border-radius:18px;padding:18px 22px;">
         <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
           <td width="34" valign="top" style="font-family:${FONT};font-size:18px;line-height:24px;">🎯</td>
           <td style="${txt(16, 24, C.onEmerald, 800)}">
             <span style="display:block;${label(C.onEmerald)}padding-bottom:5px;">UGENS FOKUS</span>
             ${focus}
           </td>
         </tr></table>
       </td></tr>`
    : "";

  return `<tr><td style="padding:24px 30px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td style="${label()}padding-bottom:10px;">NOTER FRA SAMTALEN</td></tr>
      <tr><td style="background:${C.soft};border:1px solid ${C.softBorder};border-left:5px solid ${C.emerald};border-radius:0 18px 18px 0;padding:20px 22px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:26px;mso-line-height-rule:exactly;color:${C.onyx};">${body}</td></tr>
      ${focusBox}
    </table>
  </td></tr>`;
}

function strengthBlock(strength: string | null): string {
  if (!strength) return "";
  return `<tr><td style="padding:14px 30px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#d6f7e6;border:1px solid #a9dcc3;border-radius:18px;">
      <tr><td style="padding:18px 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td width="34" valign="top" style="font-family:${FONT};font-size:18px;line-height:24px;">💪</td>
          <td style="${txt(15, 24, C.onyx)}">
            <span style="display:block;${label(C.green)}padding-bottom:5px;">HER ER DU STÆRK</span>
            ${esc(strength).replace(/\n/g, "<br>")}
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>`;
}

function rampBlock(input: SessionMailInput): string {
  const day = input.dayNo ?? 0;
  const pct = Math.max(4, Math.min(100, Math.round((day / 40) * 100)));
  return `<tr><td style="padding:14px 30px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.soft};border:1px solid ${C.softBorder};border-radius:18px;">
      <tr><td style="padding:18px 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="${label()}">DIN OPSTART</td>
            <td align="right" style="${txt(12, 18, C.onyx, 800)}">Dag ${day} af 40</td>
          </tr>
          <tr><td colspan="2" style="padding-top:11px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:4px;overflow:hidden;"><tr>
              <td width="${pct}%" height="9" bgcolor="${C.emerald}" style="font-size:0;line-height:0;">&nbsp;</td>
              <td width="${100 - pct}%" height="9" bgcolor="#d6e1e3" style="font-size:0;line-height:0;">&nbsp;</td>
            </tr></table>
          </td></tr>
          ${input.campaignName ? `<tr><td colspan="2" style="${txt(12, 18, C.muted)}padding-top:11px;">${esc(input.campaignName)}</td></tr>` : ""}
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

function shell(opts: {
  preheader: string;
  isoWeek: number;
  pill: string;
  heading: string;
  intro: string;
  blocks: string;
  leaderName: string;
  leaderRole: string;
  cta: boolean;
  remember: boolean;
}): string {
  return `<!DOCTYPE html>
<html lang="da"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<span style="display:none;font-size:1px;color:${C.bg};max-height:0;overflow:hidden;">${opts.preheader}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.bg};">
<tr><td align="center" style="padding:32px 12px 44px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;font-family:${FONT};">

  <tr><td style="padding:0 6px 14px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td style="font-family:${FONT};font-size:13px;font-weight:800;letter-spacing:2px;color:${C.onyx};">COPENHAGEN SALES</td>
      <td align="right" style="font-family:${FONT};font-size:12px;font-weight:800;color:${C.muted};">UGE ${opts.isoWeek}</td>
    </tr></table>
  </td></tr>

  <tr><td style="background:${C.white};border-radius:22px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">

      <tr><td style="padding:28px 30px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="${C.emerald}" style="border-radius:999px;padding:9px 18px;font-family:${FONT};font-size:13px;font-weight:800;color:${C.onEmerald};">${opts.pill}</td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:18px 30px 0;${txt(30, 36, C.onyx, 800)}letter-spacing:-0.6px;">${opts.heading}</td></tr>
      <tr><td style="padding:10px 30px 0;${txt(15, 24, C.muted)}">${opts.intro}</td></tr>

      ${opts.blocks}

      ${opts.remember ? `<tr><td style="padding:22px 30px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.onyx};border-radius:18px;">
          <tr><td style="padding:22px 24px;${txt(15, 24, C.light)}">
            <span style="display:block;${label(C.emerald)}padding-bottom:8px;">HUSK</span>
            Du skal aldrig sidde og tygge på noget alene. Har du en svær samtale, en indvending der driller, eller bare brug for at sparre, så fang mig. Vi er her for dig, og vi vil gerne have at du lykkes. 🤝
          </td></tr>
        </table>
      </td></tr>` : ""}

      ${opts.cta ? `<tr><td align="center" style="padding:24px 30px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td align="center" bgcolor="${C.emerald}" style="border-radius:999px;">
            <a href="${APP_URL}/opstartshold" style="display:block;padding:16px 34px;font-family:${FONT};font-size:16px;font-weight:800;color:${C.onEmerald};text-decoration:none;white-space:nowrap;">🐦 &nbsp;Åbn Stork</a>
          </td>
        </tr></table>
      </td></tr>` : ""}

      <tr><td style="padding:24px 30px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #e2eaeb;"><tr><td style="padding-top:20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="46" valign="middle"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="38" height="38" align="center" bgcolor="${C.onyx}" style="border-radius:12px;font-family:${FONT};font-size:14px;font-weight:800;color:${C.emerald};">${esc(initials(opts.leaderName)).toUpperCase()}</td></tr></table></td>
            <td valign="middle" style="${txt(14, 20, C.onyx, 800)}">${esc(opts.leaderName)}<span style="display:block;font-weight:400;font-size:13px;color:${C.muted};">${opts.leaderRole}</span></td>
          </tr></table>
        </td></tr></table>
      </td></tr>

    </table>
  </td></tr>

  <tr><td style="padding:18px 34px 0;${txt(12, 19, C.muted)}">Copenhagen Sales &middot; Amagertorv 19, 1160 København K</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

function focusLine(input: SessionMailInput): string | null {
  const area = input.focusArea?.trim();
  const note = input.focusNote?.trim();
  if (!area && !note) return null;
  if (area && note) return `${esc(area)}: ${esc(note)}`;
  return esc((area ?? note) as string);
}

export function buildSellerMail(input: SessionMailInput): { subject: string; html: string } {
  const name = firstName(input.sellerName);
  const weeks = input.weeks.slice(-6);
  const first = weeks[0]?.sales ?? 0;
  const last = weeks[weeks.length - 1]?.sales ?? 0;
  const rising = weeks.length >= 2 && last > first;

  const subject = rising
    ? `Flot arbejde, ${name} - ${first} til ${last} salg siden uge ${weeks[0].iso_week} 🚀`
    : `Din feedback fra ${firstName(input.leaderName)} · uge ${input.isoWeek}`;

  const preheader = rising
    ? `Ugens ${KIND_LABEL[input.kind]} er i hus, ${name}, og du er gået fra ${first} til ${last} salg.`
    : `Ugens ${KIND_LABEL[input.kind]} er i hus, ${name}. Her er mine noter.`;

  const heading = rising ? `Flot arbejde, ${esc(name)}! 🚀` : `Tak for i dag, ${esc(name)}`;

  const blocks = [
    quoteBlock(input.note, focusLine(input)),
    strengthBlock(input.strengthNote),
    chart(input),
    rampBlock(input),
  ].join("");

  return {
    subject,
    html: shell({
      preheader,
      isoWeek: input.isoWeek,
      pill: `&#10003;&nbsp; ${KIND_LABEL[input.kind].toUpperCase()} I HUS`,
      heading,
      intro: `Vi holdt vores ${esc(KIND_LABEL[input.kind])} i dag. Her er mine noter, plus dine tal, så du kan se hvor langt du er kommet.`,
      blocks,
      leaderName: input.leaderName,
      leaderRole: "Teamleder · altid til at fange på Teams",
      cta: true,
      remember: true,
    }),
  };
}

export function buildLeaderMail(
  input: SessionMailInput,
  recipientName: string,
): { subject: string; html: string } {
  const subject = `${input.sellerName} · ${KIND_LABEL[input.kind]} afholdt i uge ${input.isoWeek}`;
  const blocks = [
    quoteBlock(input.note, focusLine(input)),
    strengthBlock(input.strengthNote),
    chart(input),
    rampBlock(input),
  ].join("");

  return {
    subject,
    html: shell({
      preheader: `${input.sellerName} har haft ${KIND_LABEL[input.kind]} i uge ${input.isoWeek}.`,
      isoWeek: input.isoWeek,
      pill: `&#10003;&nbsp; ${KIND_LABEL[input.kind].toUpperCase()} DOKUMENTERET`,
      heading: `Hej ${esc(firstName(recipientName))}`,
      intro: `<strong>${esc(input.sellerName)}</strong> har haft ${esc(KIND_LABEL[input.kind])} i uge ${input.isoWeek} med ${esc(input.leaderName)}. Her er noterne fra samtalen.`,
      blocks,
      leaderName: input.leaderName,
      leaderRole: "Afholdt forløbet",
      cta: true,
      remember: false,
    }),
  };
}
