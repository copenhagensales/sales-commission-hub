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

// ---------------------------------------------------------------------------
// Rapport-mails: leverandørrapport, ugeplan og daglig salgsrapport.
// ---------------------------------------------------------------------------
// Mailskabeloner til rapport-mails (leverandørrapport, ugeplan, daglig salgsrapport).
// Alt udseende kommer fra mail-kittet ovenfor, så de tre rapporttyper er ét
// designsystem og ikke tre varianter. Beregningerne bag rapporterne ligger
// uændret i frontenden / de eksisterende scheduler-moduler.



export interface SupplierMailTotals {
  locations: number;
  days: number;
  amount: number;
}

export interface SurchargeChainSummary {
  chain: string;
  days: number;
  perDay: number;
  amount: number;
}

export interface SurchargeSummary {
  totalSurcharge: number;
  refundableAmount: number;
  refundClientName: string;
  chains: SurchargeChainSummary[];
}

export interface SupplierMailLocation {
  name: string;
  variant?: string | null;
  days: number;
  amount: number;
}

function diffPanel(params: {
  label: string;
  current: number;
  previous: number | null;
  reference: string;
  unit: "amount" | "count";
}): HeroPanel | null {
  const { label, current, previous, reference, unit } = params;
  if (previous === null || previous === undefined) {
    return {
      label,
      value: "Ingen data",
      reference: "Der er ikke et sammenligneligt tal",
      tone: "neutral",
    };
  }
  const diff = current - previous;
  const abs = unit === "amount" ? fmtDKK(Math.abs(diff)) : fmtInt(Math.abs(diff));
  const value = diff > 0 ? `+${abs}` : diff < 0 ? `\u2212${abs}` : abs;
  return {
    label,
    value,
    reference,
    tone: diff > 0 ? "positive" : diff < 0 ? "negative" : "neutral",
  };
}

// ---------------------------------------------------------------------------
// Leverandørrapport (report_type = 'supplier_invoice')
// ---------------------------------------------------------------------------

export function buildSupplierReportEmail(params: {
  supplierName: string;
  locationType: string;
  periodLabel: string;
  totals: SupplierMailTotals;
  attachmentName?: string | null;
  surcharge?: SurchargeSummary | null;
  locations?: SupplierMailLocation[];
  previousPeriod?: { label: string; amount: number } | null;
  message?: string | null;
}): { html: string; text: string } {
  const {
    supplierName,
    locationType,
    periodLabel,
    totals,
    attachmentName,
    surcharge,
    locations = [],
    previousPeriod = null,
    message = null,
  } = params;

  const attachSentence = attachmentName
    ? `Detaljerne pr. lokation ligger i det vedhæftede ark <strong>${esc(attachmentName)}</strong>.`
    : "Detaljerne pr. lokation kan rekvireres ved at svare på denne mail.";

  const sections: Array<{ label: string; html: string }> = [];

  if (message && message.trim()) {
    sections.push({
      label: "Besked",
      html: bodyText(esc(message).replace(/\n/g, "<br>")),
    });
  }

  const locationItems: ListItem[] = locations.map((l) => ({
    name: l.name,
    variant: [l.variant?.trim() || null, `${fmtInt(l.days)} dage`]
      .filter(Boolean)
      .join(" \u00b7 "),
    value: fmtDKK(l.amount),
  }));

  sections.push({
    label: `Lokationer \u00b7 ${fmtInt(totals.locations)} i alt \u00b7 ${fmtInt(totals.days)} dage`,
    html:
      locationItems.length > 0
        ? `${listTable(locationItems, 132)}
           <div style="padding-top:18px;">${bodyText(attachSentence)}</div>`
        : bodyText(
            "Der er ingen lokationer med bookede dage i perioden. " + attachSentence,
          ),
  });

  if (surcharge && surcharge.totalSurcharge > 0) {
    const chainItems: ListItem[] = surcharge.chains.map((c) => ({
      name: c.chain,
      variant: `${fmtInt(c.days)} dage \u00d7 ${fmtDKK(c.perDay)}`,
      value: fmtDKK(c.amount),
    }));
    chainItems.push({
      name: `Til refusion fra ${surcharge.refundClientName}`,
      variant: `Merpris i alt ${fmtDKK(surcharge.totalSurcharge)}`,
      value: fmtDKK(surcharge.refundableAmount),
    });
    sections.push({
      label: "Merpris og refusion",
      html: `${listTable(chainItems, 132)}
        <div style="padding-top:18px;">${bodyText(
          "Bilaget indeholder kun totalerne pr. lokation. Merpris og refusion fremgår ikke af arket.",
        )}</div>`,
    });
  }

  const html = renderMail({
    title: `Leverandørrapport ${supplierName} ${periodLabel}`,
    preheader: `${supplierName}: ${fmtDKK(totals.amount)} for ${periodLabel}, ${fmtInt(totals.days)} dage på ${fmtInt(totals.locations)} lokationer.`,
    mailType: "Leverandørrapport",
    heroValue: fmtInt(totals.amount),
    heroUnit: `kr i alt \u00b7 ${locationType}`,
    heroContext: periodLabel,
    panel: diffPanel({
      label: "Mod forrige periode",
      current: totals.amount,
      previous: previousPeriod ? previousPeriod.amount : null,
      reference: previousPeriod ? previousPeriod.label : "",
      unit: "amount",
    }),
    sections,
    disclaimer:
      "Beløbene er opgjort ud fra de bekræftede bookinger i perioden. Kontakt os ved spørgsmål til opgørelsen.",
    description: "Leverandørrapport",
  });

  const textLines = [
    `Leverandørrapport - ${supplierName}`,
    `${locationType} - ${periodLabel}`,
    "",
    `Beløb i alt: ${fmtDKK(totals.amount)}`,
    `Antal lokationer: ${totals.locations}`,
    `Antal dage: ${totals.days}`,
  ];
  if (previousPeriod) {
    textLines.push(
      `Forrige periode (${previousPeriod.label}): ${fmtDKK(previousPeriod.amount)}`,
    );
  }
  if (message && message.trim()) textLines.push("", message.trim());
  if (locations.length > 0) {
    textLines.push("", "Lokationer:");
    for (const l of locations) {
      const variant = l.variant?.trim() ? `${l.variant.trim()} - ` : "";
      textLines.push(`  ${l.name}: ${variant}${l.days} dage, ${fmtDKK(l.amount)}`);
    }
  }
  textLines.push(
    "",
    attachmentName
      ? `Detaljerne pr. lokation ligger i det vedhæftede ark ${attachmentName}.`
      : "Detaljerne pr. lokation kan rekvireres ved at svare på denne mail.",
  );
  if (surcharge && surcharge.totalSurcharge > 0) {
    textLines.push(
      "",
      "Merpris og refusion",
      `Merpris i alt: ${fmtDKK(surcharge.totalSurcharge)}`,
      ...surcharge.chains.map(
        (c) => `  ${c.chain}: ${c.days} dage x ${fmtDKK(c.perDay)} = ${fmtDKK(c.amount)}`,
      ),
      `Til refusion fra ${surcharge.refundClientName}: ${fmtDKK(surcharge.refundableAmount)}`,
      "Bilaget indeholder kun totalerne pr. lokation.",
    );
  }
  textLines.push("", "COPENHAGEN SALES", "Leverandørrapport");

  return { html, text: textLines.join("\n") };
}

// ---------------------------------------------------------------------------
// Intern godkendelsesmail (ikke kundevendt)
// ---------------------------------------------------------------------------

export function buildApprovalRequestEmail(params: {
  supplierName: string;
  periodLabel: string;
  recipientEmail: string;
  link: string;
  isReminder: boolean;
  reminderNumber?: number;
}): { subject: string; html: string } {
  const { supplierName, periodLabel, recipientEmail, link, isReminder, reminderNumber } =
    params;
  const subject = isReminder
    ? `Påmindelse (${reminderNumber}): Leverandørrapport for ${periodLabel} mangler godkendelse`
    : `Leverandørrapport for ${periodLabel} er klar til godkendelse`;

  const strong = (v: string) =>
    `<strong style="font-family:${FONT};font-weight:bold;color:${ONYX};">${esc(v)}</strong>`;

  const html = renderSimpleMail({
    title: subject,
    preheader: `${supplierName}, ${periodLabel}: rapporten mangler din godkendelse før afsendelse.`,
    mailType: "Godkendelse",
    heading: subject,
    lines: [
      `Leverandør: ${strong(supplierName)}`,
      `Periode: ${strong(periodLabel)}`,
      `Modtager ved afsendelse: ${strong(recipientEmail)}`,
    ],
    cta: { label: "Åbn og godkend rapporten", href: link },
    note: "Rapporten sendes først til leverandøren, når du har godkendt den.",
    description: "Intern besked om leverandørrapport",
  });
  return { subject, html };
}

// ---------------------------------------------------------------------------
// Ugeplan til kunde (report_type = 'client_week_plan')
// Ingen beløb, ingen priser, ingen merpris - og ingen sælgernavne.
// ---------------------------------------------------------------------------

export interface WeekPlanLocation {
  locationName: string;
  locationType: string;
  days: number;
  sellers: number;
  /** 7 pladser, 0 = mandag: antal sælgere på lokationen den dag (0 = ingen bemanding). */
  daySellers?: number[];
  /** 7 pladser, 0 = mandag: true hvis dagen er booket. */
  dayFlags?: boolean[];
  /** True hvis mindst én af lokationens bookinger stadig er en kladde. */
  tentative?: boolean;
}

/** Én dag i ugen: antal lokationer åbne og antal sælgere på dagen. */
export interface WeekPlanDay {
  /** 0 = mandag ... 6 = søndag */
  index: number;
  date: string; // yyyy-mm-dd
  locations: number;
  sellers: number;
}

const DAY_NAMES = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
const DAY_NAMES_LONG = [
  "Mandag",
  "Tirsdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lørdag",
  "Søndag",
];

// ---------------------------------------------------------------------------
// Ugeplan-mailen har sit eget visuelle udtryk (mørkt kort på hvid flade).
// Farverne nedenfor bruges KUN her, så øvrige rapportmails er uændrede.
// ---------------------------------------------------------------------------
const WP_CARD = "#2E3136";
const WP_CARD_2 = "#353A40";
const WP_LINE = "#3A3F45";
const WP_ROW_LINE = "#34383D";
const WP_INK = "#E6F0F1";
const WP_PALE = "#B9CBCE";
const WP_MUTED = "#7F878E";
const WP_ACCENT = "#3BE086";
const WP_FOOTER = "#26292D";
const WP_DARK = "#1C1F22";
const WP_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** Ét dagsafsnit i "Dage i ugen": label, 7-punkts graf og tal til højre. */
function wpDayRow(label: string, filled: number): string {
  const dots = Array.from({ length: 7 }, (_, i) =>
    `<td style="padding:0 3px"><div style="height:10px;border-radius:3px;background:${
      i < filled ? WP_ACCENT : WP_LINE
    };font-size:0;line-height:0">&nbsp;</div></td>`
  ).join("");
  return `<tr>
  <td style="padding:10px 0;border-bottom:1px solid ${WP_ROW_LINE};font-size:14px;font-weight:600;color:${WP_INK};font-family:${WP_FONT};white-space:nowrap;width:92px">${
    esc(label)
  }</td>
  <td style="padding:10px 16px;border-bottom:1px solid ${WP_ROW_LINE}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${dots}</tr></table></td>
  <td style="padding:10px 0;border-bottom:1px solid ${WP_ROW_LINE};font-size:15px;font-weight:700;color:${WP_INK};font-family:${WP_FONT};text-align:right;width:24px">${
    fmtInt(filled)
  }</td>
</tr>`;
}

/** Ét tabelkort pr. lokationstype: lokation som række, Man-Søn som kolonner. */
function wpGroupTable(
  title: string,
  rows: WeekPlanLocation[],
  dates: string[],
  dayFmt: Intl.DateTimeFormat,
  first: boolean,
): string {
  const head = dates
    .map((iso, i) =>
      `<td style="padding:12px 0 10px;text-align:center;width:42px"><div style="font-size:11px;font-weight:700;color:${WP_INK};font-family:${WP_FONT}">${
        esc(DAY_NAMES[i])
      }</div><div style="font-size:10px;color:${WP_MUTED};font-family:${WP_FONT}">${
        esc(dayFmt.format(new Date(`${iso}T00:00:00Z`)))
      }</div></td>`
    )
    .join("");

  const body = rows
    .map((loc) => {
      const flags = loc.dayFlags ?? [];
      const sellers = loc.daySellers ?? [];
      const cells = dates
        .map((_, i) => {
          const booked = flags[i] === true;
          const count = sellers[i] ?? 0;
          const inner = booked
            ? (count > 0
              ? `<span style="display:inline-block;min-width:26px;font-size:13px;font-weight:700;color:${WP_DARK};background:${WP_PALE};border-radius:6px;padding:4px 0;font-family:${WP_FONT}">${
                fmtInt(count)
              }</span>`
              : `<span style="display:inline-block;min-width:26px;font-size:13px;font-weight:700;color:${WP_ACCENT};font-family:${WP_FONT}">&#10003;</span>`)
            : `<span style="display:inline-block;min-width:26px;font-size:13px;color:${WP_MUTED};font-family:${WP_FONT}">&#8211;</span>`;
          return `<td style="padding:12px 0;border-top:1px solid ${WP_LINE};text-align:center">${inner}</td>`;
        })
        .join("");
      const tag = loc.tentative
        ? `<div style="margin-top:6px"><span style="display:inline-block;font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${WP_MUTED};border:1px solid ${WP_LINE};border-radius:4px;padding:3px 6px;font-family:${WP_FONT}">Kladde</span></div>`
        : "";
      return `<tr>
      <td style="padding:12px 12px 12px 14px;border-top:1px solid ${WP_LINE}">
        <div style="font-size:14px;font-weight:600;color:${WP_INK};line-height:1.3;font-family:${WP_FONT}">${
        esc(loc.locationName)
      }</div>
        <div style="margin-top:5px;font-size:12px;color:${WP_MUTED};font-family:${WP_FONT}">${
        esc(
          `${fmtInt(loc.days)} ${loc.days === 1 ? "dag" : "dage"} \u00b7 ${fmtInt(loc.sellers)} ${
            loc.sellers === 1 ? "sælger" : "sælgere"
          }`,
        )
      }</div>
        ${tag}
      </td>
      ${cells}
      <td style="border-top:1px solid ${WP_LINE}"></td>
    </tr>`;
    })
    .join("");

  return `<tr><td style="padding:${first ? "18px" : "26px"} 0 12px">
  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${WP_ACCENT};vertical-align:middle"></span>
  <span style="font-size:12px;font-weight:700;letter-spacing:.16em;color:${WP_INK};text-transform:uppercase;font-family:${WP_FONT};padding-left:10px;vertical-align:middle">${
    esc(title)
  }</span>
</td></tr>
<tr><td>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${WP_CARD_2};border-radius:14px">
    <tr style="background:${WP_LINE}">
      <td style="padding:12px 0 10px 14px;font-size:10px;font-weight:700;letter-spacing:.14em;color:${WP_MUTED};text-transform:uppercase;font-family:${WP_FONT}">Lokation</td>
      ${head}
      <td style="width:14px"></td>
    </tr>
    ${body}
  </table>
</td></tr>`;
}

function wpKpi(value: string, label: string, accent = false): string {
  return `<td width="33.33%" style="padding:0 6px" valign="top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${WP_CARD_2};border-radius:12px"><tr><td style="padding:16px 16px 14px"><div style="font-size:30px;line-height:1;font-weight:700;color:${
    accent ? WP_ACCENT : WP_INK
  };font-family:${WP_FONT}">${value}</div><div style="margin-top:8px;font-size:12px;line-height:1.35;color:${WP_MUTED};font-family:${WP_FONT}">${label}</div></td></tr></table></td>`;
}

function wpSectionLabel(text: string): string {
  return `<div style="padding-bottom:6px;border-bottom:1px solid ${WP_LINE};font-size:11px;font-weight:700;letter-spacing:.18em;color:${WP_MUTED};text-transform:uppercase;font-family:${WP_FONT}">${
    esc(text)
  }</div>`;
}

function wpNote(text: string, top: number): string {
  return `<div style="padding-top:${top}px;font-size:12px;line-height:1.6;color:${WP_MUTED};font-family:${WP_FONT}">${
    esc(text)
  }</div>`;
}

export function buildClientWeekPlanEmail(params: {
  clientName: string;
  isoWeek: number;
  weekStart: string; // yyyy-mm-dd (mandag)
  weekEnd: string; // yyyy-mm-dd (søndag)
  locations: WeekPlanLocation[];
  previousWeek?: { isoWeek: number; days: number } | null;
  days?: WeekPlanDay[];
}): { subject: string; html: string; text: string } {
  const {
    clientName,
    isoWeek,
    weekStart,
    weekEnd,
    locations,
    previousWeek = null,
    days = [],
  } = params;

  const dateFmt = new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const startLabel = dateFmt.format(new Date(`${weekStart}T00:00:00Z`));
  const endLabel = dateFmt.format(new Date(`${weekEnd}T00:00:00Z`));
  const subtitle = `uge ${isoWeek}, ${startLabel} til ${endLabel}`;
  const subject = `Ugeplan - ${clientName} (uge ${isoWeek})`;

  const totalDays = locations.reduce((s, l) => s + l.days, 0);
  const totalSellers = locations.reduce((s, l) => s + l.sellers, 0);

  const groups = new Map<string, WeekPlanLocation[]>();
  for (const loc of locations) {
    const key = loc.locationType || "Ukendt type";
    const list = groups.get(key) ?? [];
    list.push(loc);
    groups.set(key, list);
  }
  const groupKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b, "da"));
  for (const key of groupKeys) {
    groups
      .get(key)!
      .sort(
        (a, b) => b.days - a.days || a.locationName.localeCompare(b.locationName, "da"),
      );
  }

  // Dagsopdeling: så modtageren kan se om fx fredag er mindre end mandag.
  const dayFmt = new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "numeric",
    timeZone: "UTC",
  });

  const gridDates = days.length === 7
    ? days.map((d) => d.date)
    : Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${weekStart}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });

  const diff = previousWeek ? totalDays - previousWeek.days : null;
  const diffValue = diff === null
    ? "Ingen data"
    : diff > 0
    ? `+${fmtInt(diff)}`
    : diff < 0
    ? `\u2212${fmtInt(Math.abs(diff))}`
    : fmtInt(0);
  const diffLabel = previousWeek
    ? `mod ugen før <span style="color:${WP_PALE}">\u00b7 uge ${previousWeek.isoWeek}</span>`
    : "Der er ikke et sammenligneligt tal";

  const daysHtml = days.length === 0 ? "" : `<tr><td style="background:${WP_CARD};padding:0 34px 30px">
    ${wpSectionLabel("Dage i ugen \u00b7 Lokationer pr. dag")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px">
${
    days
      .map((d) =>
        wpDayRow(
          `${DAY_NAMES[d.index] ?? ""} ${dayFmt.format(new Date(`${d.date}T00:00:00Z`))}`,
          d.locations,
        )
      )
      .join("\n")
  }
    </table>
  </td></tr>`;

  const detailHtml = locations.length === 0
    ? wpNote(
      "Der er ingen bookinger i ugen, så planen indeholder ingen lokationer.",
      8,
    )
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${
      groupKeys
        .map((key, i) => wpGroupTable(key, groups.get(key)!, gridDates, dayFmt, i === 0))
        .join("")
    }</table>`;

  const preheader =
    `uge ${isoWeek}, ${startLabel} til ${endLabel} — ${fmtInt(totalDays)} dage i alt \u00b7 ${
      fmtInt(locations.length)
    } lokationer`;

  const html = `<!doctype html>
<html lang="da"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#FFFFFF">
<div style="display:none;font-size:0;line-height:0;max-height:0;overflow:hidden">${
    esc(preheader)
  }</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF">
<tr><td align="center" style="padding:32px 16px 48px">
<table role="presentation" width="660" cellpadding="0" cellspacing="0" border="0" style="width:660px;max-width:660px">

  <tr><td style="background:${WP_CARD};border-radius:20px 20px 0 0;padding:34px 34px 30px;border-bottom:1px solid ${WP_LINE}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td valign="top"><img src="${LOGO_URL}" alt="Copenhagen Sales" height="38" style="height:38px;width:auto;display:block;border:0" /></td>
      <td valign="top" align="right" style="padding-top:6px;font-size:11px;font-weight:700;letter-spacing:.18em;color:${WP_MUTED};text-transform:uppercase;font-family:${WP_FONT}">uge ${isoWeek}</td>
    </tr></table>
    <div style="margin-top:30px;font-size:40px;line-height:1;font-weight:700;letter-spacing:.22em;color:${WP_INK};font-family:${WP_FONT}">UGEPLAN</div>
    <div style="margin-top:14px;font-size:15px;line-height:1.5;color:${WP_PALE};font-family:${WP_FONT}">${
    esc(subtitle)
  }</div>
  </td></tr>

  <tr><td style="background:${WP_CARD};padding:24px 28px 26px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      ${wpKpi(fmtInt(totalDays), "dage i alt")}
      ${wpKpi(fmtInt(locations.length), "lokationer")}
      ${wpKpi(diffValue, diffLabel, diff !== null && diff > 0)}
    </tr></table>
  </td></tr>

  ${daysHtml}

  <tr><td style="background:${WP_CARD};padding:0 34px 34px">
    ${wpSectionLabel("Lokationer \u00b7 Dag for dag")}
    ${detailHtml}
  </td></tr>

  <tr><td style="background:${WP_FOOTER};padding:24px 34px;border-top:1px solid ${WP_LINE};font-size:12px;line-height:1.65;color:${WP_MUTED};font-family:${WP_FONT}">Planen viser dagsfordelingen samt antal dage og antal sælgere pr. lokation. Ændringer kan forekomme i løbet af ugen.</td></tr>

  <tr><td style="background:${WP_FOOTER};border-radius:0 0 20px 20px;padding:22px 34px 26px;border-top:1px solid ${WP_LINE}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font-size:11px;font-weight:700;letter-spacing:.2em;color:${WP_INK};text-transform:uppercase;font-family:${WP_FONT}">COPENHAGEN SALES</td>
      <td align="right" style="font-size:11px;letter-spacing:.14em;color:${WP_MUTED};text-transform:uppercase;font-family:${WP_FONT}">Ugeplan</td>
    </tr></table>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  const textLines = [
    `Ugeplan - ${clientName}`,
    subtitle,
    "",
    `Dage i alt: ${totalDays}`,
    `Lokationer: ${locations.length}`,
    `Sælgere i alt: ${totalSellers}`,
  ];
  if (previousWeek) textLines.push(`Uge ${previousWeek.isoWeek}: ${previousWeek.days} dage`);
  textLines.push("");
  if (days.length > 0) {
    textLines.push("Dage i ugen (lokationer / sælgere)");
    for (const d of days) {
      textLines.push(
        `  ${DAY_NAMES_LONG[d.index]}: ${d.locations} lokationer, ${d.sellers} sælgere`,
      );
    }
    textLines.push("");
  }
  for (const key of groupKeys) {
    textLines.push(key);
    for (const l of groups.get(key)!) {
      const perDay = DAY_NAMES.map((n, i) => {
        const booked = (l.dayFlags ?? [])[i] === true;
        const count = (l.daySellers ?? [])[i] ?? 0;
        return `${n} ${booked ? (count > 0 ? String(count) : "x") : "-"}`;
      }).join(", ");
      textLines.push(
        `  ${l.locationName}${l.tentative ? " (kladde)" : ""}: ${l.days} dage, ${l.sellers} ${
          l.sellers === 1 ? "sælger" : "sælgere"
        } | ${perDay}`,
      );
    }
    textLines.push("");
  }
  textLines.push(
    "Planen viser antal dage og antal sælgere pr. lokation. Ændringer kan forekomme i løbet af ugen.",
    "",
    "COPENHAGEN SALES",
    "Ugeplan",
  );

  return { subject, html, text: textLines.join("\n") };
}

export function buildWeekPlanEmptyWarningEmail(params: {
  clientName: string;
  isoWeek: number;
  weekStart: string;
  weekEnd: string;
}): { subject: string; html: string } {
  const { clientName, isoWeek, weekStart, weekEnd } = params;
  const subject = `Intern advarsel: ugeplanen for ${clientName} (uge ${isoWeek}) er tom`;
  const strong = (v: string) =>
    `<strong style="font-family:${FONT};font-weight:bold;color:${ONYX};">${esc(v)}</strong>`;
  const html = renderSimpleMail({
    title: subject,
    preheader: `Uge ${isoWeek} for ${clientName} er tom. Der er ikke sendt en ugeplan til kunden.`,
    mailType: "Intern advarsel",
    heading: "Ugeplanen er tom - intet er sendt",
    lines: [
      `Kunde: ${strong(clientName)}`,
      `Uge: ${strong(String(isoWeek))} (${esc(weekStart)} til ${esc(weekEnd)})`,
      "Der er ingen bekræftede bookinger i ugen, så ugeplanen er IKKE sendt til kunden. Udsendelsen er registreret som sprunget over.",
    ],
    cta: null,
    note: "Læg bookinger ind og send planen manuelt, hvis ugen skulle have haft bemanding.",
    description: "Intern besked om ugeplan",
  });
  return { subject, html };
}

// ---------------------------------------------------------------------------
// Daglig salgsrapport til kunde (report_type = 'client_daily_sales')
// Ingen beløb, ingen priser, ingen provision - og ingen sælger- eller
// lokationsnavne. Søjlerne er indlejrede HTML-tabeller, og tallet står altid
// som tekst ved siden af søjlen.
// ---------------------------------------------------------------------------

export interface DailySalesProductRow {
  productName: string;
  quantity: number;
}

export interface DailySalesTrendPoint {
  date: string; // yyyy-mm-dd
  quantity: number;
}

/**
 * Måned til dato for den måned rapportdagen ligger i.
 * Beregnes generisk pr. kunde - ingen kundespecifik logik.
 */
export interface DailySalesMonthToDate {
  start: string; // yyyy-mm-01
  quantity: number;
  saleCount: number;
  activeDays: number;
}

const DAY_SHORT = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];

function dayLabel(iso: string): string {
  return DAY_SHORT[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

function isWeekend(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
}

function dateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

export function buildClientDailySalesEmail(params: {
  clientName: string;
  date: string; // yyyy-mm-dd (i går)
  totalQuantity: number;
  saleCount: number;
  products: DailySalesProductRow[];
  trend: DailySalesTrendPoint[];
  comparison: { date: string; quantity: number } | null;
  monthToDate?: DailySalesMonthToDate | null;
}): { subject: string; html: string; text: string } {
  const { clientName, date, totalQuantity, saleCount, products, trend, comparison } =
    params;
  const monthToDate = params.monthToDate ?? null;
  const monthLabel = new Intl.DateTimeFormat("da-DK", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

  const dateLabel = new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
  const subject = `Salg i går - ${clientName} (${dateShort(date)})`;

  const sorted = [...products].sort(
    (a, b) => b.quantity - a.quantity || a.productName.localeCompare(b.productName, "da"),
  );

  const productItems: ListItem[] = sorted.map((p) => ({
    name: p.productName,
    variant: null,
    value: fmtInt(p.quantity),
  }));

  const sections: Array<{ label: string; html: string }> = [
    {
      label: "Fordeling pr. produkt",
      html:
        productItems.length > 0
          ? listTable(productItems, 80)
          : bodyText("Der er ingen registrerede salg på dagen."),
    },
  ];

  if (monthToDate) {
    const avg = monthToDate.activeDays > 0
      ? monthToDate.quantity / monthToDate.activeDays
      : 0;
    const mtdItems: ListItem[] = [
      {
        name: "Salg i alt",
        variant: null,
        value: fmtInt(monthToDate.quantity),
      },
      {
        name: "Dage med salg",
        variant: null,
        value: fmtInt(monthToDate.activeDays),
      },
      {
        name: "Gennemsnit pr. dag med salg",
        variant: null,
        value: avg.toFixed(1).replace(".", ","),
      },
    ];
    sections.push({
      label: `Måned til dato (${monthLabel})`,
      html: `${listTable(mtdItems, 80)}
        <div style="padding-top:18px;">${
        bodyText(
          esc(
            `Perioden er ${dateShort(monthToDate.start)} til ${dateShort(date)}.`,
          ),
        )
      }</div>`,
    });
  }


  if (trend.length > 0) {
    const points: BarPoint[] = trend.map((t, i) => ({
      label: dateShort(t.date),
      sublabel: dayLabel(t.date),
      value: t.quantity,
      weekend: isWeekend(t.date),
      latest: i === trend.length - 1,
    }));
    let comparisonLine: string;
    if (!comparison) {
      comparisonLine =
        "Der er ikke et sammenligneligt tal for samme ugedag i ugen før.";
    } else {
      const diff = totalQuantity - comparison.quantity;
      comparisonLine =
        diff === 0
          ? `Samme antal som ${dayLabel(comparison.date)} den ${dateShort(comparison.date)}, hvor der var ${comparison.quantity}.`
          : `${Math.abs(diff)} ${diff > 0 ? "flere" : "færre"} end ${dayLabel(comparison.date)} den ${dateShort(comparison.date)}, hvor der var ${comparison.quantity}.`;
    }
    sections.push({
      label: "Seneste dage med salg",
      html: `${barChart(points)}
        <div style="padding-top:18px;">${bodyText(esc(comparisonLine))}</div>`,
    });
  }

  const countNote =
    saleCount !== totalQuantity ? ` \u00b7 fordelt på ${fmtInt(saleCount)} salg` : "";

  let panelValue: HeroPanel | null;
  if (!comparison) {
    panelValue = {
      label: "Samme ugedag ugen før",
      value: "Ingen data",
      reference: "Der er ikke et sammenligneligt tal",
      tone: "neutral",
    };
  } else {
    const diff = totalQuantity - comparison.quantity;
    panelValue = {
      label: "Samme ugedag ugen før",
      value:
        diff > 0
          ? `+${fmtInt(diff)}`
          : diff < 0
            ? `\u2212${fmtInt(Math.abs(diff))}`
            : "0",
      reference: `${dayLabel(comparison.date)} ${dateShort(comparison.date)}: ${fmtInt(comparison.quantity)}`,
      tone: diff > 0 ? "positive" : diff < 0 ? "negative" : "neutral",
    };
  }

  const html = renderMail({
    title: subject,
    preheader: `${clientName}: ${fmtInt(totalQuantity)} salg den ${dateShort(date)}, fordelt på ${fmtInt(sorted.length)} produkter.`,
    mailType: "Daglig rapport",
    heroValue: fmtInt(totalQuantity),
    heroUnit: `salg i alt${countNote}`,
    heroContext: dateLabel,
    panel: panelValue,
    sections,
    disclaimer: "Tallene er foreløbige. Efterfølgende annulleringer kan ændre dem.",
    description: "Daglig salgsrapport",
  });

  const textLines = [
    `Salg i går - ${clientName}`,
    dateLabel,
    "",
    `Salg i alt: ${totalQuantity}`,
  ];
  if (saleCount !== totalQuantity) textLines.push(`Fordelt på ${saleCount} salg.`);
  if (monthToDate) {
    textLines.push(
      "",
      `Måned til dato (${monthLabel}): ${monthToDate.quantity} salg på ${monthToDate.activeDays} dage med salg.`,
    );
  }
  textLines.push("", "Fordeling pr. produkt:");
  for (const p of sorted) textLines.push(`  ${p.productName}: ${p.quantity}`);
  if (trend.length > 0) {
    textLines.push("", "Seneste dage med salg:");
    for (const t of trend) {
      textLines.push(`  ${dateShort(t.date)} ${dayLabel(t.date)}: ${t.quantity}`);
    }
  }
  if (comparison) {
    const diff = totalQuantity - comparison.quantity;
    textLines.push(
      "",
      diff === 0
        ? `Samme antal som ${dayLabel(comparison.date)} den ${dateShort(comparison.date)}, hvor der var ${comparison.quantity}.`
        : `${Math.abs(diff)} ${diff > 0 ? "flere" : "færre"} end ${dayLabel(comparison.date)} den ${dateShort(comparison.date)}, hvor der var ${comparison.quantity}.`,
    );
  } else {
    textLines.push("", "Der er ikke et sammenligneligt tal for samme ugedag i ugen før.");
  }
  textLines.push(
    "",
    "Tallene er foreløbige. Efterfølgende annulleringer kan ændre dem.",
    "",
    "COPENHAGEN SALES",
    "Daglig salgsrapport",
  );

  return { subject, html, text: textLines.join("\n") };
}

// Genbrugt af scheduleren til pæne datoer i logs/labels.
export { dateShort, dayLabel };
