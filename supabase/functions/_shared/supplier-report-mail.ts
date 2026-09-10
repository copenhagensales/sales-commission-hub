// Mailskabeloner til leverandørrapporter.
// Copenhagen Sales-farver (fra projektets tokens i index.css):
//   onyx        #2E3136  (--cph-onyx 218 8% 20%)
//   light blue  #E6F0F1  (--cph-light-blue 186 28% 92%)
//   emerald     #3BE086  (--cph-emerald 147 73% 55%)
//   white       #FFFFFF
// Kontrast (WCAG, beregnet):
//   #2E3136 på #FFFFFF  = 13.0:1
//   #2E3136 på #E6F0F1  = 11.2:1
//   #2E3136 på #3BE086  = 7.6:1
//   #FFFFFF på #2E3136  = 13.0:1
//   #4F545B på #FFFFFF  = 7.4:1 (sekundær tekst)
// Grøn bruges kun som baggrund med næsten sort tekst eller som tynd accentstribe.

const ONYX = "#2E3136";
const LIGHT = "#E6F0F1";
const EMERALD = "#3BE086";
const BORDER = "#C9D6D8";
const SECONDARY = "#4F545B";
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

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

export function fmtDKK(value: number): string {
  return (
    new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(
      Math.round(value),
    ) + " kr"
  );
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font-size:14px;color:${SECONDARY};font-family:${FONT};">${label}</td>
    <td align="right" style="padding:8px 0;font-size:14px;font-weight:700;color:${ONYX};font-family:${FONT};">${value}</td>
  </tr>`;
}

export function buildSupplierReportEmail(params: {
  supplierName: string;
  locationType: string;
  periodLabel: string;
  totals: SupplierMailTotals;
  attachmentName?: string | null;
  surcharge?: SurchargeSummary | null;
}): { html: string; text: string } {
  const { supplierName, locationType, periodLabel, totals, attachmentName, surcharge } =
    params;

  const attachSentence = attachmentName
    ? `Detaljerne pr. lokation ligger i det vedhæftede ark <strong>${attachmentName}</strong>.`
    : "Detaljerne pr. lokation kan rekvireres ved at svare på denne mail.";

  const surchargeBlock =
    surcharge && surcharge.totalSurcharge > 0
      ? `
        <tr><td style="padding:0 0 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:2px solid ${ONYX};border-radius:8px;">
            <tr><td style="height:6px;background:${EMERALD};line-height:6px;font-size:0;">&nbsp;</td></tr>
            <tr><td style="padding:16px 20px;background:${LIGHT};">
              <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:${ONYX};font-family:${FONT};">Intern note: merpris og refusion</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${row("Merpris i alt", fmtDKK(surcharge.totalSurcharge))}
                ${surcharge.chains
                  .map((c) =>
                    row(
                      `${c.chain} (${c.days} dage x ${fmtDKK(c.perDay)})`,
                      fmtDKK(c.amount),
                    ),
                  )
                  .join("")}
                ${row(
                  `Til refusion fra ${surcharge.refundClientName}`,
                  fmtDKK(surcharge.refundableAmount),
                )}
              </table>
              <p style="margin:10px 0 0;font-size:13px;color:${ONYX};font-family:${FONT};">Bilaget indeholder kun totalerne pr. lokation. Merpris og refusion fremgår ikke af arket.</p>
            </td></tr>
          </table>
        </td></tr>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Leverandørrapport ${supplierName} ${periodLabel}</title></head>
<body style="margin:0;padding:0;background:${LIGHT};">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${LIGHT};padding:24px 12px;">
<tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid ${BORDER};border-radius:12px;">
    <tr><td style="background:${ONYX};padding:20px 24px;border-radius:12px 12px 0 0;">
      <p style="margin:0;font-size:18px;font-weight:800;color:#FFFFFF;font-family:${FONT};letter-spacing:0.5px;">COPENHAGEN SALES</p>
    </td></tr>
    <tr><td style="height:4px;background:${EMERALD};line-height:4px;font-size:0;">&nbsp;</td></tr>
    <tr><td style="padding:24px 24px 8px;">
      <h1 style="margin:0 0 4px;font-size:20px;font-weight:800;color:${ONYX};font-family:${FONT};">Leverandørrapport - ${supplierName}</h1>
      <p style="margin:0;font-size:14px;color:${ONYX};font-family:${FONT};">${locationType} &middot; ${periodLabel}</p>
    </td></tr>
    <tr><td style="padding:8px 24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${LIGHT};border:1px solid ${BORDER};border-radius:8px;">
        <tr><td style="padding:12px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            ${row("Periode", periodLabel)}
            ${row("Antal lokationer", String(totals.locations))}
            ${row("Antal dage", String(totals.days))}
            ${row("Beløb i alt", fmtDKK(totals.amount))}
          </table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:16px 24px 0;">
      <p style="margin:0;font-size:14px;line-height:1.6;color:${ONYX};font-family:${FONT};">${attachSentence}</p>
    </td></tr>
    <tr><td style="padding:16px 24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${surchargeBlock}</table>
    </td></tr>
    <tr><td style="padding:20px 24px 24px;">
      <p style="margin:0;font-size:12px;color:${SECONDARY};font-family:${FONT};">Copenhagen Sales ApS &middot; Automatisk fremsendt leverandørrapport</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const textLines = [
    `Leverandørrapport - ${supplierName}`,
    `${locationType} - ${periodLabel}`,
    "",
    `Periode: ${periodLabel}`,
    `Antal lokationer: ${totals.locations}`,
    `Antal dage: ${totals.days}`,
    `Beløb i alt: ${fmtDKK(totals.amount)}`,
    "",
    attachmentName
      ? `Detaljerne pr. lokation ligger i det vedhæftede ark ${attachmentName}.`
      : "Detaljerne pr. lokation kan rekvireres ved at svare på denne mail.",
  ];
  if (surcharge && surcharge.totalSurcharge > 0) {
    textLines.push(
      "",
      "Intern note: merpris og refusion",
      `Merpris i alt: ${fmtDKK(surcharge.totalSurcharge)}`,
      ...surcharge.chains.map(
        (c) => `${c.chain} (${c.days} dage x ${fmtDKK(c.perDay)}): ${fmtDKK(c.amount)}`,
      ),
      `Til refusion fra ${surcharge.refundClientName}: ${fmtDKK(surcharge.refundableAmount)}`,
      "Bilaget indeholder kun totalerne pr. lokation.",
    );
  }
  textLines.push("", "Copenhagen Sales ApS");

  return { html, text: textLines.join("\n") };
}

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

  const html = `<!DOCTYPE html>
<html lang="da"><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:${LIGHT};">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${LIGHT};padding:24px 12px;">
<tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid ${BORDER};border-radius:12px;">
    <tr><td style="background:${ONYX};padding:20px 24px;border-radius:12px 12px 0 0;">
      <p style="margin:0;font-size:18px;font-weight:800;color:#FFFFFF;font-family:${FONT};letter-spacing:0.5px;">COPENHAGEN SALES</p>
    </td></tr>
    <tr><td style="height:4px;background:${EMERALD};line-height:4px;font-size:0;">&nbsp;</td></tr>
    <tr><td style="padding:24px;">
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;color:${ONYX};font-family:${FONT};">${subject}</h1>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:${ONYX};font-family:${FONT};">Leverandør: <strong>${supplierName}</strong></p>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:${ONYX};font-family:${FONT};">Periode: <strong>${periodLabel}</strong></p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${ONYX};font-family:${FONT};">Modtager ved afsendelse: <strong>${recipientEmail}</strong></p>
      <table cellpadding="0" cellspacing="0" role="presentation"><tr>
        <td style="background:${EMERALD};border-radius:8px;">
          <a href="${link}" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:700;color:${ONYX};text-decoration:none;font-family:${FONT};">Åbn og godkend rapporten</a>
        </td>
      </tr></table>
      <p style="margin:16px 0 0;font-size:13px;color:${SECONDARY};font-family:${FONT};">Rapporten sendes først til leverandøren, når du har godkendt den.</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  return { subject, html };
}

// ---------------------------------------------------------------------------
// Ugeplan til kunde (report_type = 'client_week_plan')
// Samme CS-skabelon og samme kontrastregler som leverandørrapporten.
// Ingen beløb, ingen priser, ingen merpris - og ingen sælgernavne.
// ---------------------------------------------------------------------------

export interface WeekPlanLocation {
  locationName: string;
  locationType: string;
  days: number;
  sellers: number;
}

export function buildClientWeekPlanEmail(params: {
  clientName: string;
  isoWeek: number;
  weekStart: string; // yyyy-mm-dd (mandag)
  weekEnd: string; // yyyy-mm-dd (søndag)
  locations: WeekPlanLocation[];
}): { subject: string; html: string; text: string } {
  const { clientName, isoWeek, weekStart, weekEnd, locations } = params;

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

  // Grupperet på lokationstype, lokationer alfabetisk indenfor hver gruppe.
  const groups = new Map<string, WeekPlanLocation[]>();
  for (const loc of locations) {
    const key = loc.locationType || "Ukendt type";
    const list = groups.get(key) ?? [];
    list.push(loc);
    groups.set(key, list);
  }
  const groupKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b, "da"));
  for (const key of groupKeys) {
    groups.get(key)!.sort((a, b) => a.locationName.localeCompare(b.locationName, "da"));
  }

  const th = (align: string) =>
    `padding:10px 12px;text-align:${align};font-size:12px;font-weight:700;color:${ONYX};font-family:${FONT};border-bottom:2px solid ${ONYX};`;
  const td = (align: string) =>
    `padding:10px 12px;text-align:${align};font-size:14px;color:${ONYX};font-family:${FONT};border-bottom:1px solid ${BORDER};`;

  const tableBody = groupKeys
    .map((key) => {
      const rows = groups
        .get(key)!
        .map(
          (l) => `<tr>
            <td style="${td("left")}">${l.locationName}</td>
            <td style="${td("right")}">${l.days}</td>
            <td style="${td("right")}">${l.sellers}</td>
          </tr>`,
        )
        .join("");
      return `<tr><td colspan="3" style="padding:14px 12px 6px;font-size:13px;font-weight:800;color:${ONYX};font-family:${FONT};background:${LIGHT};">${key}</td></tr>${rows}`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:${LIGHT};">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${LIGHT};padding:24px 12px;">
<tr><td align="center">
  <table width="640" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:640px;background:#FFFFFF;border:1px solid ${BORDER};border-radius:12px;">
    <tr><td style="background:${ONYX};padding:20px 24px;border-radius:12px 12px 0 0;">
      <p style="margin:0;font-size:18px;font-weight:800;color:#FFFFFF;font-family:${FONT};letter-spacing:0.5px;">COPENHAGEN SALES</p>
    </td></tr>
    <tr><td style="height:4px;background:${EMERALD};line-height:4px;font-size:0;">&nbsp;</td></tr>
    <tr><td style="padding:24px 24px 8px;">
      <h1 style="margin:0 0 4px;font-size:20px;font-weight:800;color:${ONYX};font-family:${FONT};">Ugeplan - ${clientName}</h1>
      <p style="margin:0;font-size:14px;color:${ONYX};font-family:${FONT};">${subtitle}</p>
    </td></tr>
    <tr><td style="padding:12px 24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${LIGHT};border:1px solid ${BORDER};border-radius:8px;">
        <tr><td style="padding:12px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            ${row("Antal lokationer", String(locations.length))}
            ${row("Antal dage i alt", String(totalDays))}
          </table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:16px 24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
        <thead><tr>
          <th style="${th("left")}">Lokation</th>
          <th style="${th("right")}">Dage</th>
          <th style="${th("right")}">Sælgere</th>
        </tr></thead>
        <tbody>${tableBody}</tbody>
      </table>
    </td></tr>
    <tr><td style="padding:20px 24px 24px;">
      <p style="margin:0;font-size:12px;color:${SECONDARY};font-family:${FONT};">Copenhagen Sales ApS &middot; Planlagt bemanding for den kommende uge. Antal sælgere er angivet som antal, ikke navne.</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const textLines = [
    `Ugeplan - ${clientName}`,
    subtitle,
    "",
    `Antal lokationer: ${locations.length}`,
    `Antal dage i alt: ${totalDays}`,
    "",
  ];
  for (const key of groupKeys) {
    textLines.push(key);
    for (const l of groups.get(key)!) {
      textLines.push(`  ${l.locationName}: ${l.days} dage, ${l.sellers} sælgere`);
    }
    textLines.push("");
  }
  textLines.push("Copenhagen Sales ApS");

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
  const html = `<!DOCTYPE html>
<html lang="da"><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:${LIGHT};">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${LIGHT};padding:24px 12px;">
<tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid ${BORDER};border-radius:12px;">
    <tr><td style="background:${ONYX};padding:20px 24px;border-radius:12px 12px 0 0;">
      <p style="margin:0;font-size:18px;font-weight:800;color:#FFFFFF;font-family:${FONT};letter-spacing:0.5px;">COPENHAGEN SALES</p>
    </td></tr>
    <tr><td style="height:4px;background:${EMERALD};line-height:4px;font-size:0;">&nbsp;</td></tr>
    <tr><td style="padding:24px;">
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;color:${ONYX};font-family:${FONT};">Ugeplanen er tom - intet er sendt</h1>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:${ONYX};font-family:${FONT};">Kunde: <strong>${clientName}</strong></p>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:${ONYX};font-family:${FONT};">Uge: <strong>${isoWeek}</strong> (${weekStart} til ${weekEnd})</p>
      <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:${ONYX};font-family:${FONT};">Der er ingen bekræftede bookinger i ugen, så ugeplanen er IKKE sendt til kunden. Udsendelsen er registreret som sprunget over.</p>
      <p style="margin:12px 0 0;font-size:13px;color:${SECONDARY};font-family:${FONT};">Læg bookinger ind og send planen manuelt, hvis ugen skulle have haft bemanding.</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  return { subject, html };
}

// ---------------------------------------------------------------------------
// Daglig salgsrapport til kunde (report_type = 'client_daily_sales')
// Samme CS-skabelon og samme kontrastregler som de to andre typer.
// Ingen beløb, ingen priser, ingen provision - og ingen sælger- eller lokationsnavne.
// Søjlerne er indlejrede HTML-tabeller (ikke SVG, ikke billeder), og tallet
// står altid som tekst ved siden af søjlen.
// Søjlefarve #2E3136 på sporets baggrund #E6F0F1 = 11.2:1 (krav: mindst 3:1).
// ---------------------------------------------------------------------------

export interface DailySalesProductRow {
  productName: string;
  quantity: number;
}

export interface DailySalesTrendPoint {
  date: string; // yyyy-mm-dd
  quantity: number;
}

const DAY_SHORT = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];

function dayLabel(iso: string): string {
  return DAY_SHORT[new Date(`${iso}T00:00:00Z`).getUTCDay()];
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
}): { subject: string; html: string; text: string } {
  const { clientName, date, totalQuantity, saleCount, products, trend, comparison } =
    params;

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

  const th = (align: string) =>
    `padding:10px 12px;text-align:${align};font-size:12px;font-weight:700;color:${ONYX};font-family:${FONT};border-bottom:2px solid ${ONYX};`;
  const td = (align: string) =>
    `padding:10px 12px;text-align:${align};font-size:14px;color:${ONYX};font-family:${FONT};border-bottom:1px solid ${BORDER};`;

  const productRows = sorted
    .map(
      (p) => `<tr>
        <td style="${td("left")}">${p.productName}</td>
        <td style="${td("right")}"><strong>${p.quantity}</strong></td>
      </tr>`,
    )
    .join("");

  const maxTrend = trend.reduce((m, t) => Math.max(m, t.quantity), 0) || 1;
  const trendRows = trend
    .map((t) => {
      const pct = Math.max(3, Math.round((t.quantity / maxTrend) * 100));
      return `<tr>
        <td style="padding:5px 8px 5px 0;font-size:12px;color:${ONYX};font-family:${FONT};white-space:nowrap;">${dateShort(t.date)} ${dayLabel(t.date)}</td>
        <td style="padding:5px 8px;width:100%;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${LIGHT};border:1px solid ${BORDER};border-radius:3px;">
            <tr><td style="padding:0;">
              <table width="${pct}%" cellpadding="0" cellspacing="0" role="presentation">
                <tr><td style="height:14px;background:${ONYX};line-height:14px;font-size:0;border-radius:3px;">&nbsp;</td></tr>
              </table>
            </td></tr>
          </table>
        </td>
        <td align="right" style="padding:5px 0 5px 8px;font-size:13px;font-weight:700;color:${ONYX};font-family:${FONT};white-space:nowrap;">${t.quantity}</td>
      </tr>`;
    })
    .join("");

  let comparisonLine: string;
  if (!comparison) {
    comparisonLine = `Der er ikke et sammenligneligt tal for samme ugedag i ugen før.`;
  } else {
    const diff = totalQuantity - comparison.quantity;
    const direction = diff > 0 ? "flere" : diff < 0 ? "færre" : "det samme antal som";
    comparisonLine =
      diff === 0
        ? `Samme antal som ${dayLabel(comparison.date)} den ${dateShort(comparison.date)} (${comparison.quantity}).`
        : `${Math.abs(diff)} ${direction} end ${dayLabel(comparison.date)} den ${dateShort(comparison.date)}, hvor der var ${comparison.quantity}.`;
  }

  const countNote =
    saleCount !== totalQuantity
      ? `<p style="margin:4px 0 0;font-size:13px;color:${SECONDARY};font-family:${FONT};">Fordelt på ${saleCount} salg.</p>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:${LIGHT};">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${LIGHT};padding:24px 12px;">
<tr><td align="center">
  <table width="640" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:640px;background:#FFFFFF;border:1px solid ${BORDER};border-radius:12px;">
    <tr><td style="background:${ONYX};padding:20px 24px;border-radius:12px 12px 0 0;">
      <p style="margin:0;font-size:18px;font-weight:800;color:#FFFFFF;font-family:${FONT};letter-spacing:0.5px;">COPENHAGEN SALES</p>
    </td></tr>
    <tr><td style="height:4px;background:${EMERALD};line-height:4px;font-size:0;">&nbsp;</td></tr>
    <tr><td style="padding:24px 24px 8px;">
      <h1 style="margin:0 0 4px;font-size:20px;font-weight:800;color:${ONYX};font-family:${FONT};">Salg i går - ${clientName}</h1>
      <p style="margin:0;font-size:14px;color:${ONYX};font-family:${FONT};">${dateLabel}</p>
    </td></tr>
    <tr><td style="padding:12px 24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${LIGHT};border:1px solid ${BORDER};border-radius:8px;">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0;font-size:34px;font-weight:800;color:${ONYX};font-family:${FONT};line-height:1.1;">${totalQuantity}</p>
          <p style="margin:2px 0 0;font-size:14px;color:${ONYX};font-family:${FONT};">salg i alt</p>
          ${countNote}
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:20px 24px 0;">
      <p style="margin:0 0 6px;font-size:15px;font-weight:800;color:${ONYX};font-family:${FONT};">Fordeling pr. produkt</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
        <thead><tr>
          <th style="${th("left")}">Produkt</th>
          <th style="${th("right")}">Antal</th>
        </tr></thead>
        <tbody>${productRows}</tbody>
      </table>
    </td></tr>
    <tr><td style="padding:22px 24px 0;">
      <p style="margin:0 0 6px;font-size:15px;font-weight:800;color:${ONYX};font-family:${FONT};">Seneste dage med salg</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${trendRows}</table>
      <p style="margin:10px 0 0;font-size:13px;color:${ONYX};font-family:${FONT};">${comparisonLine}</p>
    </td></tr>
    <tr><td style="padding:20px 24px 24px;">
      <p style="margin:0;font-size:12px;color:${SECONDARY};font-family:${FONT};">Tallene er foreløbige. Efterfølgende annulleringer kan ændre dem.</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const textLines = [
    `Salg i går - ${clientName}`,
    dateLabel,
    "",
    `Salg i alt: ${totalQuantity}`,
  ];
  if (saleCount !== totalQuantity) textLines.push(`Fordelt på ${saleCount} salg.`);
  textLines.push("", "Fordeling pr. produkt:");
  for (const p of sorted) textLines.push(`  ${p.productName}: ${p.quantity}`);
  textLines.push("", "Seneste dage med salg:");
  for (const t of trend) {
    textLines.push(`  ${dateShort(t.date)} ${dayLabel(t.date)}: ${t.quantity}`);
  }
  textLines.push(
    "",
    comparisonLine,
    "",
    "Tallene er foreløbige. Efterfølgende annulleringer kan ændre dem.",
  );

  return { subject, html, text: textLines.join("\n") };
}
