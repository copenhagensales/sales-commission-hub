// ---------------------------------------------------------------------------
// Copenhagen Sales - fælles e-mailskabelon til ALLE rapport-mails.
// Én motor, tre rapporttyper. Kun tabeller, kun inline styles, ingen webfonte,
// ingen JavaScript, ingen eksterne stylesheets, ingen SVG og ingen billeder som
// bærende element: mailen er fuldstændig og læsbar med billeder slået fra.
//
// Farver (og målt kontrast, WCAG relative luminans):
//   #2E3136 Onyx      på #FFFFFF = 12.99:1   |  på #E6F0F1 = 11.19:1
//   #FFFFFF           på #2E3136 = 12.99:1
//   #3BE086 Emerald   på #2E3136 =  7.62:1   (Emerald bruges KUN på Onyx)
//   #B9CBCE           på #2E3136 =  7.53:1   |  på #3A3F45 = 6.72:1 (sekundær, <7:1 kun i 10-13px labels -> se note)
//   #4F545B           på #FFFFFF =  7.61:1   (sekundær tekst på hvid)
//   #7F878E søjlefyld på #E6F0F1 =  3.10:1   (dæmpet weekend-søjle, grafisk element)
//   #2E3136 søjlefyld på #E6F0F1 = 11.19:1
// De præcise tal regnes i scripts/mail-contrast (se rapporten i chatten).
// ---------------------------------------------------------------------------

export const ONYX = "#2E3136";
export const LIGHT = "#E6F0F1";
export const EMERALD = "#3BE086";
export const PANEL = "#3A3F45";
export const ON_DARK_SECONDARY = "#B9CBCE";
export const WHITE = "#FFFFFF";
export const SECONDARY = "#4F545B";
export const BAR_MUTED = "#7F878E";
export const DIVIDER = "#E6F0F1";

export const FONT = "Arial, Helvetica, sans-serif";

/**
 * Offentlig URL - mail kan ikke bruge relative stier.
 * Ligger i den offentlige bucket 'client-logos' under brand/, fordi platformen
 * ikke tillader at oprette nye offentlige buckets.
 */
export const LOGO_URL =
  "https://jwlimmeijpfmaksvmuru.supabase.co/storage/v1/object/public/client-logos/brand/cph-sales-logo.png";

const LH = "mso-line-height-rule:exactly;";

export function esc(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmtInt(value: number): string {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(
    Math.round(value),
  );
}

export function fmtDKK(value: number): string {
  return `${fmtInt(value)} kr`;
}

/** Skjult preheader, ca. 85 tegn, med mailens nøgletal skrevet ind. */
function preheaderBlock(text: string): string {
  const trimmed = text.length > 90 ? `${text.slice(0, 87)}...` : text;
  return `<div style="display:none;font-size:1px;color:${LIGHT};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(trimmed)}&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;</div>`;
}

/** Brandbar: logo til venstre, mailtype som TEKST i Emerald til højre. */
function brandBar(mailType: string): string {
  return `<tr><td style="background:${ONYX};padding:24px 32px;border-radius:16px 16px 0 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="536" style="width:536px;">
    <tr>
      <td width="320" align="left" valign="middle" style="width:320px;">
        <img src="${LOGO_URL}" width="120" height="72" alt="Copenhagen Sales" style="display:block;border:0;outline:none;text-decoration:none;">
      </td>
      <td width="216" align="right" valign="middle" style="width:216px;font-family:${FONT};font-size:11px;line-height:16px;${LH}font-weight:bold;letter-spacing:1.6px;color:${EMERALD};text-transform:uppercase;">${esc(mailType)}</td>
    </tr>
  </table>
</td></tr>
<tr><td height="4" style="height:4px;line-height:4px;font-size:0;background:${EMERALD};">&nbsp;</td></tr>`;
}

export interface HeroPanel {
  label: string;
  value: string;
  reference: string;
  /** positive = Emerald med +, negative = lyseblå med -, neutral = lyseblå. */
  tone: "positive" | "negative" | "neutral";
}

/** Hero på Onyx: ét stort tal, og højst ét sammenligningspanel. */
function hero(params: {
  value: string;
  unit: string;
  context: string;
  panel: HeroPanel | null;
}): string {
  const { value, unit, context, panel } = params;
  const big = value.length > 7 ? 64 : 88;
  const bigLine = value.length > 7 ? 60 : 80;

  const panelCell = panel
    ? `<td width="196" align="right" valign="top" style="width:196px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="196" style="width:196px;background:${PANEL};border-radius:12px;">
          <tr><td style="padding:16px 18px;font-family:${FONT};">
            <div style="font-size:10px;line-height:14px;${LH}font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:${ON_DARK_SECONDARY};">${esc(panel.label)}</div>
            <div style="padding-top:8px;font-size:30px;line-height:30px;${LH}font-weight:bold;color:${panel.tone === "positive" ? EMERALD : LIGHT};">${esc(panel.value)}</div>
            <div style="padding-top:6px;font-size:13px;line-height:18px;${LH}color:${ON_DARK_SECONDARY};">${esc(panel.reference)}</div>
          </td></tr>
        </table>
      </td>`
    : "";

  const valueWidth = panel ? 320 : 536;

  return `<tr><td style="background:${ONYX};padding:32px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="536" style="width:536px;">
    <tr>
      <td width="${valueWidth}" align="left" valign="top" style="width:${valueWidth}px;font-family:${FONT};">
        <div style="font-size:${big}px;line-height:${bigLine}px;${LH}font-weight:bold;color:${WHITE};">${esc(value)}</div>
        <div style="padding-top:10px;font-size:13px;line-height:18px;${LH}color:${ON_DARK_SECONDARY};">${esc(unit)}</div>
        <div style="padding-top:2px;font-size:13px;line-height:18px;${LH}color:${ON_DARK_SECONDARY};">${esc(context)}</div>
      </td>
      ${panelCell}
    </tr>
  </table>
</td></tr>`;
}

function eyebrow(text: string): string {
  return `<div style="font-family:${FONT};font-size:11px;line-height:16px;${LH}font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${SECONDARY};padding-bottom:14px;">${esc(text)}</div>`;
}

/** Hvidt afsnit med eyebrow-label. */
function section(label: string, inner: string, first = false): string {
  return `<tr><td style="background:${WHITE};padding:${first ? 32 : 0}px 32px 32px;">
  ${eyebrow(label)}
  ${inner}
</td></tr>`;
}

export interface ListItem {
  name: string;
  /** Variant/undertekst uden parenteser. */
  variant?: string | null;
  value: string;
}

/** To-niveau liste: navn + variant til venstre, tal højrestillet i egen kolonne. */
export function listTable(items: ListItem[], valueWidth = 120): string {
  const nameWidth = 536 - valueWidth;
  const rows = items
    .map((it, i) => {
      const border = i === 0 ? "" : `border-top:1px solid ${DIVIDER};`;
      const variant = it.variant
        ? `<div style="padding-top:3px;font-family:${FONT};font-size:13px;line-height:18px;${LH}color:${SECONDARY};">${esc(it.variant)}</div>`
        : "";
      return `<tr>
        <td width="${nameWidth}" align="left" valign="top" style="width:${nameWidth}px;padding:14px 12px 14px 0;${border}">
          <div style="font-family:${FONT};font-size:16px;line-height:22px;${LH}font-weight:bold;color:${ONYX};">${esc(it.name)}</div>
          ${variant}
        </td>
        <td width="${valueWidth}" align="right" valign="top" style="width:${valueWidth}px;padding:14px 0;${border}font-family:${FONT};font-size:24px;line-height:28px;${LH}font-weight:bold;color:${ONYX};white-space:nowrap;">${esc(it.value)}</td>
      </tr>`;
    })
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="536" style="width:536px;">${rows}</table>`;
}

/** Gruppeoverskrift inde i en liste (fx lokationstype). */
export function groupHeading(text: string, first = false): string {
  return `<div style="font-family:${FONT};font-size:11px;line-height:16px;${LH}font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${ONYX};padding:${first ? 0 : 22}px 0 8px;">${esc(text)}</div>`;
}

export interface BarPoint {
  label: string;
  sublabel: string;
  value: number;
  weekend: boolean;
  latest: boolean;
}

/**
 * Søjlediagram som indlejrede tabeller. Tallet står ALTID som tekst i egen
 * kolonne, så søjlen aldrig er eneste kilde.
 */
export function barChart(points: BarPoint[]): string {
  const max = points.reduce((m, p) => Math.max(m, p.value), 0) || 1;
  const trackWidth = 536 - 76 - 44 - 12;
  const rows = points
    .map((p) => {
      const raw = Math.max(4, Math.round((p.value / max) * 100));
      // Plads til Emerald-cap'en på nyeste dag, så markeringen altid er synlig.
      const pct = p.latest ? Math.min(raw, 94) : raw;
      const height = p.latest ? 18 : 14;
      const fill = p.weekend && !p.latest ? BAR_MUTED : ONYX;
      const cap = p.latest
        ? `<td width="4" style="width:4px;height:${height}px;line-height:${height}px;font-size:0;background:${EMERALD};">&nbsp;</td>`
        : "";
      return `<tr>
        <td width="76" align="left" valign="middle" style="width:76px;padding:6px 0;font-family:${FONT};font-size:13px;line-height:18px;${LH}color:${ONYX};white-space:nowrap;">${esc(p.label)} ${esc(p.sublabel)}</td>
        <td width="${trackWidth}" valign="middle" style="width:${trackWidth}px;padding:6px 12px 6px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:${LIGHT};border-radius:4px;">
            <tr><td style="padding:0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${pct}%" style="width:${pct}%;">
                <tr>
                  <td style="height:${height}px;line-height:${height}px;font-size:0;background:${fill};border-radius:4px;">&nbsp;</td>
                  ${cap}
                </tr>
              </table>
            </td></tr>
          </table>
        </td>
        <td width="44" align="right" valign="middle" style="width:44px;padding:6px 0;font-family:${FONT};font-size:${p.latest ? 17 : 15}px;line-height:21px;${LH}font-weight:bold;color:${ONYX};white-space:nowrap;">${fmtInt(p.value)}</td>
      </tr>`;
    })
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="536" style="width:536px;">${rows}</table>`;
}

export function bodyText(text: string): string {
  return `<div style="font-family:${FONT};font-size:15px;line-height:21px;${LH}color:${ONYX};">${text}</div>`;
}

function footer(params: { disclaimer: string; description: string }): string {
  return `<tr><td style="background:${WHITE};padding:0 32px 32px;border-radius:0 0 16px 16px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="536" style="width:536px;">
    <tr><td height="1" style="height:1px;line-height:1px;font-size:0;background:${DIVIDER};">&nbsp;</td></tr>
    <tr><td style="padding-top:20px;font-family:${FONT};">
      <div style="font-size:12px;line-height:19px;${LH}color:${SECONDARY};">${esc(params.disclaimer)}</div>
      <div style="padding-top:14px;font-size:12px;line-height:19px;${LH}font-weight:bold;color:${ONYX};">COPENHAGEN SALES</div>
      <div style="font-size:12px;line-height:19px;${LH}color:${SECONDARY};">${esc(params.description)}</div>
    </td></tr>
  </table>
</td></tr>`;
}

export interface MailShellParams {
  title: string;
  preheader: string;
  mailType: string;
  heroValue: string;
  heroUnit: string;
  heroContext: string;
  panel: HeroPanel | null;
  sections: Array<{ label: string; html: string }>;
  disclaimer: string;
  description: string;
}

export function renderMail(p: MailShellParams): string {
  const sections = p.sections
    .map((s, i) => section(s.label, s.html, i === 0))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="da" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(p.title)}</title>
<!--[if mso]><style>table,td,div,p,a{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
<style>
@media only screen and (max-width:620px){
  .cs-card{width:100% !important;}
  .cs-row{width:100% !important;}
  .cs-stack{display:block !important;width:100% !important;text-align:left !important;padding-top:16px !important;}
}
</style>
</head>
<body style="margin:0;padding:0;background:${LIGHT};">
${preheaderBlock(p.preheader)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:${LIGHT};">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="cs-card" style="width:600px;max-width:600px;background:${WHITE};border-radius:16px;">
${brandBar(p.mailType)}
${hero({ value: p.heroValue, unit: p.heroUnit, context: p.heroContext, panel: p.panel })}
${sections}
${footer({ disclaimer: p.disclaimer, description: p.description })}
  </table>
</td></tr>
</table>
</body>
</html>`;
}

/** Enkel intern mail (godkendelse, advarsel) i samme skabelon. */
export function renderSimpleMail(p: {
  title: string;
  preheader: string;
  mailType: string;
  heading: string;
  lines: string[];
  cta?: { label: string; href: string } | null;
  note?: string | null;
  description: string;
}): string {
  const lines = p.lines
    .map(
      (l) =>
        `<div style="padding-bottom:8px;font-family:${FONT};font-size:15px;line-height:21px;${LH}color:${ONYX};">${l}</div>`,
    )
    .join("");
  const cta = p.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr>
        <td style="background:${ONYX};border-radius:10px;">
          <a href="${p.cta.href}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:15px;line-height:18px;${LH}font-weight:bold;color:${WHITE};text-decoration:none;">${esc(p.cta.label)}</a>
        </td></tr></table>`
    : "";
  const note = p.note
    ? `<div style="padding-top:16px;font-family:${FONT};font-size:13px;line-height:18px;${LH}color:${SECONDARY};">${esc(p.note)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(p.title)}</title>
<!--[if mso]><style>table,td,div,p,a{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
<style>@media only screen and (max-width:620px){.cs-card{width:100% !important;}}</style>
</head>
<body style="margin:0;padding:0;background:${LIGHT};">
${preheaderBlock(p.preheader)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:${LIGHT};">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="cs-card" style="width:600px;max-width:600px;background:${WHITE};border-radius:16px;">
${brandBar(p.mailType)}
    <tr><td style="background:${WHITE};padding:32px;">
      <div style="font-family:${FONT};font-size:24px;line-height:30px;${LH}font-weight:bold;color:${ONYX};padding-bottom:16px;">${esc(p.heading)}</div>
      ${lines}
      ${cta}
      ${note}
    </td></tr>
${footer({ disclaimer: "", description: p.description })}
  </table>
</td></tr>
</table>
</body>
</html>`;
}
