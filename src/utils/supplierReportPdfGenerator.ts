/**
 * Utility to generate and download a supplier report as PDF
 * Uses browser's print-to-PDF functionality — optimised for A4 landscape
 */

interface WeekDays {
  week: number;
  days: number[];
}

interface LocationRow {
  locationName: string;
  externalId?: string;
  city: string;
  client: string;
  weekdays: WeekDays[];
  bookings: number;
  days: number;
  dailyRate: number | string;
  amount: number;
  discount: number;
  discountAmount: number;
  finalAmount: number;
  isExcluded: boolean;
  maxDiscount: number | null;
}

interface SupplierReportPdfConfig {
  locationType: string;
  month: string;
  locations: LocationRow[];
  discountType: "placements" | "annual_revenue" | string;
  minDaysPerLocation: number;
  hasDiscountRules: boolean;
  totals: {
    subtotal: number;
    discountAmount: number;
    finalAmount: number;
  };
  discountInfo: {
    uniquePlacements: number;
    discountPercent: number;
    discountDescription: string | null;
    ytdRevenue?: number;
    monthlyRevenue?: number;
    staircaseSteps?: Array<{ minRevenue: number; discountPercent: number }>;
  };
  exceptions: Array<{ name: string; type: string; maxDiscount: number | null }>;
}

function fmtKr(n: number): string {
  return n.toLocaleString("da-DK") + " kr";
}

const WEEKDAY_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function renderWeekdaysBadges(weekdays: WeekDays[]): string {
  if (!weekdays || weekdays.length === 0) return "-";

  return weekdays
    .sort((a, b) => a.week - b.week)
    .map((w) => {
      const sorted = [...w.days].sort((a, b) => a - b);
      const weekdayOnly = sorted.filter((d) => d <= 4);
      const isFullWeek = [0, 1, 2, 3, 4].every((d) => weekdayOnly.includes(d)) && weekdayOnly.length === 5;

      const badges = isFullWeek
        ? '<span class="day-badge full">Man–Fre</span>'
        : sorted.map((d) => `<span class="day-badge">${WEEKDAY_LABELS[d] || d}</span>`).join(" ");

      return `<div class="week-row"><span class="week-label">Uge ${w.week}</span>${badges}</div>`;
    })
    .join("");
}

export function downloadSupplierReportPdf(config: SupplierReportPdfConfig) {
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) {
    alert("Pop-up blokeret. Tillad venligst pop-ups for at downloade rapporten.");
    return;
  }

  const isAnnualRevenue = config.discountType === "annual_revenue";
  const isMonthlyRevenue = config.discountType === "monthly_revenue";
  const isRevenueType = isAnnualRevenue || isMonthlyRevenue;
  const showDiscount = config.hasDiscountRules;

  const locationRows = config.locations
    .map(
      (loc) => `
      <tr class="${loc.isExcluded ? "excluded" : ""}">
        <td class="cell-name">
          ${loc.locationName}
          ${loc.isExcluded ? ' <span class="badge badge-excluded">Udelukket</span>' : ""}
          ${loc.maxDiscount != null && !loc.isExcluded ? ` <span class="badge badge-max">Max ${loc.maxDiscount}%</span>` : ""}
        </td>
        <td>${loc.externalId || "-"}</td>
        <td>${loc.city || "-"}</td>
        <td>${loc.client || "-"}</td>
        <td class="cell-weekdays">${renderWeekdaysBadges(loc.weekdays)}</td>
        <td class="num">${loc.bookings}</td>
        <td class="num">${loc.days}</td>
        <td class="num">${typeof loc.dailyRate === "number" ? fmtKr(loc.dailyRate) : loc.dailyRate}</td>
        <td class="num">${fmtKr(loc.amount)}</td>
        ${
          showDiscount
            ? `<td class="num accent">${loc.isExcluded ? '<span class="muted">Separat</span>' : `-${loc.discount}%`}</td>
               <td class="num">${loc.isExcluded ? "-" : fmtKr(loc.finalAmount)}</td>`
            : ""
        }
      </tr>`
    )
    .join("");

  const exceptionsHtml =
    config.exceptions.length > 0
      ? `
      <div class="section">
        <h3>Undtagelser</h3>
        <ul class="exceptions">
          ${config.exceptions
            .map(
              (exc) =>
                `<li><strong>${exc.name}</strong>: ${exc.type === "excluded" ? "Pris aftales separat" : `Max ${exc.maxDiscount}% rabat`}</li>`
            )
            .join("")}
        </ul>
      </div>`
      : "";

  const staircaseHtml =
    isRevenueType && config.discountInfo.staircaseSteps?.length
      ? `
      <div class="staircase">
        <h4>Rabattrappe</h4>
        <div class="staircase-row">
          ${config.discountInfo.staircaseSteps
            .map(
              (s) => {
                const lookupValue = isMonthlyRevenue ? config.totals.subtotal : (config.discountInfo.ytdRevenue ?? 0);
                return `<div class="staircase-step ${lookupValue >= s.minRevenue ? "active" : ""}">${s.discountPercent}%<br><span class="step-label">${fmtKr(s.minRevenue)}+</span></div>`;
              }
            )
            .join("")}
        </div>
      </div>`
      : "";

  const placementNote = config.minDaysPerLocation > 1
    ? `<p class="placement-note">1 placering = min. ${config.minDaysPerLocation} sammenhængende dage på samme lokation</p>`
    : "";

  const discountSectionHtml = !showDiscount
    ? ""
    : isMonthlyRevenue
    ? `
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-label">Månedsomsætning (denne periode)</span>
          <span class="kpi-value">${fmtKr(config.discountInfo.monthlyRevenue ?? config.totals.subtotal)}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Nuværende rabattrin</span>
          <span class="kpi-value">${config.discountInfo.discountPercent > 0 ? `${config.discountInfo.discountPercent}%` : "Ingen"}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Samlet rabat (denne md)</span>
          <span class="kpi-value accent">-${fmtKr(config.totals.discountAmount)}</span>
        </div>
        <div class="kpi-card highlight">
          <span class="kpi-label">Total efter rabat</span>
          <span class="kpi-value">${fmtKr(config.totals.finalAmount)}</span>
        </div>
      </div>
      ${staircaseHtml}`
    : isAnnualRevenue
    ? `
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-label">Kumulativ årsomsætning</span>
          <span class="kpi-value">${fmtKr(config.discountInfo.ytdRevenue ?? 0)}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Nuværende rabattrin</span>
          <span class="kpi-value">${config.discountInfo.discountPercent > 0 ? `${config.discountInfo.discountPercent}%` : "Ingen"}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Samlet rabat (denne md)</span>
          <span class="kpi-value accent">-${fmtKr(config.totals.discountAmount)}</span>
        </div>
        <div class="kpi-card highlight">
          <span class="kpi-label">Total efter rabat</span>
          <span class="kpi-value">${fmtKr(config.totals.finalAmount)}</span>
        </div>
      </div>
      ${staircaseHtml}`
    : `
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-label">Placeringer</span>
          <span class="kpi-value">${config.discountInfo.uniquePlacements}</span>
          ${placementNote}
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Rabattrin</span>
          <span class="kpi-value">${config.discountInfo.discountPercent > 0 ? `${config.discountInfo.discountPercent}%` : "Ingen"}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Rabatbeløb</span>
          <span class="kpi-value accent">-${fmtKr(config.totals.discountAmount)}</span>
        </div>
        <div class="kpi-card highlight">
          <span class="kpi-label">Total efter rabat</span>
          <span class="kpi-value">${fmtKr(config.totals.finalAmount)}</span>
        </div>
      </div>`;

  const html = `<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="UTF-8">
<title>Leverandørrapport – ${config.locationType} – ${config.month}</title>
<style>
@page{size:A4 landscape;margin:12mm 10mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;line-height:1.5;color:#1e293b;background:#ffffff;padding:12mm 10mm;margin:0 auto;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}

/* Header */
.header{padding:12px 0;margin-bottom:20px;border-bottom:2px solid #1e293b}
.header h1{font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.01em}
.header .meta{color:#64748b;font-size:12px;margin-top:2px}

/* Section */
.section{margin-bottom:24px}
.section h3{font-size:13px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px}

/* Table */
table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:11px}
th{background:#f1f5f9;color:#334155;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;padding:8px 10px;text-align:left;border:1px solid #cbd5e1;white-space:nowrap}
td{padding:7px 10px;border:1px solid #e2e8f0;color:#1e293b;vertical-align:top}
tbody tr:nth-child(even){background:#f8fafc}
.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.cell-name{font-weight:600;color:#0f172a;white-space:nowrap}
tfoot td{font-weight:700;background:#f1f5f9;color:#0f172a;border-top:2px solid #94a3b8}

/* Weekdays badges */
.cell-weekdays{min-width:120px}
.week-row{display:flex;align-items:center;gap:4px;margin-bottom:3px;flex-wrap:nowrap}
.week-label{font-size:9px;font-weight:700;color:#64748b;min-width:36px;flex-shrink:0}
.day-badge{display:inline-block;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:600;background:#e2e8f0;color:#334155;white-space:nowrap}
.day-badge.full{background:#d1fae5;color:#065f46}

/* Excluded rows */
.excluded td{opacity:.5}

/* Badges */
.badge{display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;margin-left:4px;vertical-align:middle}
.badge-excluded{background:#fee2e2;color:#b91c1c}
.badge-max{background:#e0e7ff;color:#3730a3}

/* Accent color for discount */
.accent{color:#059669}
.muted{color:#94a3b8;font-style:italic}

/* KPI Grid */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.kpi-card{background:#f8fafc;padding:14px 16px;border-radius:6px;border:1px solid #e2e8f0}
.kpi-card.highlight{border-color:#6366f1;background:#eef2ff}
.kpi-label{display:block;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;font-weight:600}
.kpi-value{display:block;font-size:16px;font-weight:700;color:#0f172a;white-space:nowrap}
.kpi-value.accent{color:#059669}
.placement-note{font-size:9px;color:#64748b;margin-top:4px}

/* Staircase */
.staircase{margin-top:16px}
.staircase h4{font-size:12px;color:#475569;margin-bottom:8px;font-weight:700}
.staircase-row{display:flex;gap:8px}
.staircase-step{flex:1;text-align:center;background:#f8fafc;border:1px solid #e2e8f0;padding:12px 8px;border-radius:6px;font-size:14px;font-weight:700;color:#64748b}
.staircase-step.active{background:#eef2ff;border-color:#6366f1;color:#4f46e5}
.step-label{font-size:10px;font-weight:500;color:#94a3b8}

/* Exceptions */
.exceptions{margin-left:20px;font-size:12px;color:#475569}
.exceptions li{margin-bottom:4px}
.exceptions strong{color:#1e293b}

/* Footer */
.footer{margin-top:30px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:10px}

</style>
</head>
<body>
  <div class="header">
    <h1>Leverandørrapport: ${config.locationType}</h1>
    <div class="meta">Periode: ${config.month}</div>
  </div>

  <div class="section">
    <h3>Bookinger</h3>
    <table>
      <thead>
        <tr>
          <th>Lokation</th><th>ID</th><th>By</th><th>Kunde</th><th>Uger & Dage</th>
          <th class="num">Book.</th><th class="num">Dage</th><th class="num">Dagspris</th><th class="num">Beløb</th>
          ${showDiscount ? '<th class="num">Rabat</th><th class="num">Efter rabat</th>' : ""}
        </tr>
      </thead>
      <tbody>${locationRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="${showDiscount ? 8 : 8}">Subtotal</td>
          <td class="num">${fmtKr(config.totals.subtotal)}</td>
          ${showDiscount ? `<td class="num accent">-${fmtKr(config.totals.discountAmount)}</td><td class="num">${fmtKr(config.totals.finalAmount)}</td>` : ""}
        </tr>
      </tfoot>
    </table>
  </div>

  ${showDiscount ? `
  <div class="section">
    <h3>Rabatberegning</h3>
    ${discountSectionHtml}
  </div>
  ` : ""}

  ${exceptionsHtml}

  <div class="footer">
    Dokument genereret ${new Date().toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
  </div>

  <script>window.onload=function(){window.print()}<\/script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
