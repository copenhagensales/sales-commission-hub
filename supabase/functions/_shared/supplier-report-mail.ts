// Mailskabeloner til rapport-mails (leverandørrapport, ugeplan, daglig salgsrapport).
// Alt udseende kommer fra report-mail-kit.ts, så de tre rapporttyper er ét
// designsystem og ikke tre varianter. Beregningerne bag rapporterne ligger
// uændret i frontenden / de eksisterende scheduler-moduler.
import {
  barChart,
  bodyText,
  esc,
  fmtDKK as kitFmtDKK,
  fmtInt,
  FONT,
  groupHeading,
  type BarPoint,
  type HeroPanel,
  type ListItem,
  listTable,
  ONYX,
  renderMail,
  renderSimpleMail,
} from "./report-mail-kit.ts";

export const fmtDKK = kitFmtDKK;

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
}

export function buildClientWeekPlanEmail(params: {
  clientName: string;
  isoWeek: number;
  weekStart: string; // yyyy-mm-dd (mandag)
  weekEnd: string; // yyyy-mm-dd (søndag)
  locations: WeekPlanLocation[];
  previousWeek?: { isoWeek: number; days: number } | null;
}): { subject: string; html: string; text: string } {
  const { clientName, isoWeek, weekStart, weekEnd, locations, previousWeek = null } =
    params;

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

  const detailHtml =
    locations.length === 0
      ? bodyText(
          "Der er ingen bekræftede bookinger i ugen, så planen indeholder ingen lokationer.",
        )
      : groupKeys
          .map((key, i) => {
            const items: ListItem[] = groups.get(key)!.map((l) => ({
              name: l.locationName,
              variant: `${fmtInt(l.sellers)} ${l.sellers === 1 ? "sælger" : "sælgere"}`,
              value: `${fmtInt(l.days)}`,
            }));
            return `${groupHeading(key, i === 0)}${listTable(items, 80)}`;
          })
          .join("");

  const html = renderMail({
    title: subject,
    preheader: `Uge ${isoWeek}: ${fmtInt(totalDays)} dage på ${fmtInt(locations.length)} lokationer for ${clientName}.`,
    mailType: "Ugeplan",
    heroValue: fmtInt(totalDays),
    heroUnit: `dage i alt \u00b7 ${fmtInt(locations.length)} lokationer`,
    heroContext: subtitle,
    panel: diffPanel({
      label: "Mod ugen før",
      current: totalDays,
      previous: previousWeek ? previousWeek.days : null,
      reference: previousWeek ? `uge ${previousWeek.isoWeek}` : "",
      unit: "count",
    }),
    sections: [
      {
        label: `Lokationer \u00b7 dage og antal sælgere`,
        html: detailHtml,
      },
    ],
    disclaimer:
      "Planen viser antal dage og antal sælgere pr. lokation. Ændringer kan forekomme i løbet af ugen.",
    description: "Ugeplan",
  });

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
  for (const key of groupKeys) {
    textLines.push(key);
    for (const l of groups.get(key)!) {
      textLines.push(
        `  ${l.locationName}: ${l.days} dage, ${l.sellers} ${l.sellers === 1 ? "sælger" : "sælgere"}`,
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
