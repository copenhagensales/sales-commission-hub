/**
 * Utility to generate and download a supplier report as PDF
 * Uses browser's print-to-PDF functionality
 */

interface LocationRow {
  locationName: string;
  city: string;
  client: string;
  period: string;
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
    staircaseSteps?: Array<{ minRevenue: number; discountPercent: number }>;
  };
  exceptions: Array<{ name: string; type: string; maxDiscount: number | null }>;
}

function fmtKr(n: number): string {
  return n.toLocaleString("da-DK") + " kr";
}

export function downloadSupplierReportPdf(config: SupplierReportPdfConfig) {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    alert("Pop-up blokeret. Tillad venligst pop-ups for at downloade rapporten.");
    return;
  }

  const isAnnualRevenue = config.discountType === "annual_revenue";

  const locationRows = config.locations
    .map(
      (loc) => `
      <tr class="${loc.isExcluded ? "excluded" : ""}">
        <td class="cell-name">
          ${loc.locationName}
          ${loc.isExcluded ? ' <span class="badge badge-excluded">Udelukket</span>' : ""}
          ${loc.maxDiscount != null && !loc.isExcluded ? ` <span class="badge badge-max">Max ${loc.maxDiscount}%</span>` : ""}
        </td>
        <td>${loc.city || "-"}</td>
        <td>${loc.client || "-"}</td>
        <td>${loc.period}</td>
        <td class="num">${loc.bookings}</td>
        <td class="num">${loc.days}</td>
        <td class="num">${typeof loc.dailyRate === "number" ? fmtKr(loc.dailyRate) : loc.dailyRate}</td>
        <td class="num">${fmtKr(loc.amount)}</td>
        ${
          isAnnualRevenue
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
    isAnnualRevenue && config.discountInfo.staircaseSteps?.length
      ? `
      <div class="staircase">
        <h4>Rabattrappe</h4>
        <div class="staircase-row">
          ${config.discountInfo.staircaseSteps
            .map(
              (s) =>
                `<div class="staircase-step ${config.discountInfo.ytdRevenue != null && config.discountInfo.ytdRevenue >= s.minRevenue ? "active" : ""}">${s.discountPercent}%<br><span class="step-label">${fmtKr(s.minRevenue)}+</span></div>`
            )
            .join("")}
        </div>
      </div>`
      : "";

  const discountSectionHtml = isAnnualRevenue
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
          <span class="kpi-label">Bookinger</span>
          <span class="kpi-value">${config.discountInfo.uniquePlacements}</span>
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
@page{size:A4;margin:15mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;color:#e2e8f0;background:#0f1419;padding:15mm;max-width:210mm;margin:0 auto;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}

/* Header */
.header{padding-bottom:20px;margin-bottom:28px;border-bottom:1px solid rgba(255,255,255,0.08)}
.header h1{font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em}
.header .meta{color:#64748b;font-size:13px;margin-top:4px}

/* Section */
.section{margin-bottom:28px}
.section h3{font-size:14px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px}

/* Table */
table{width:100%;border-collapse:separate;border-spacing:0;margin-bottom:24px;border-radius:8px;overflow:hidden}
th{background:#1e293b;color:#94a3b8;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;padding:8px 6px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.06)}
td{padding:7px 6px;font-size:10px;border-bottom:1px solid rgba(255,255,255,0.04);color:#cbd5e1}
tbody tr{background:#151d27}
tbody tr:nth-child(even){background:#1a2332}
tbody tr:hover{background:#1e2d3d}
.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.cell-name{font-weight:500;color:#f1f5f9}
tfoot td{font-weight:700;background:#1e293b;color:#f1f5f9;border-top:2px solid rgba(255,255,255,0.08);border-bottom:none}

/* Excluded rows */
.excluded td{opacity:.45}

/* Badges */
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;margin-left:6px;vertical-align:middle}
.badge-excluded{background:rgba(239,68,68,0.15);color:#f87171}
.badge-max{background:rgba(99,102,241,0.15);color:#818cf8}

/* Accent color for discount */
.accent{color:#34d399}
.muted{color:#475569;font-style:italic;font-size:11px}

/* KPI Grid */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.kpi-card{background:#1e293b;padding:16px;border-radius:8px;border:1px solid rgba(255,255,255,0.06)}
.kpi-card.highlight{border-color:rgba(99,102,241,0.3);background:#1e2747}
.kpi-label{display:block;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px}
.kpi-value{display:block;font-size:20px;font-weight:700;color:#f1f5f9}
.kpi-value.accent{color:#34d399}

/* Staircase */
.staircase{margin-top:16px}
.staircase h4{font-size:13px;color:#94a3b8;margin-bottom:8px;font-weight:600}
.staircase-row{display:flex;gap:8px}
.staircase-step{flex:1;text-align:center;background:#1e293b;border:1px solid rgba(255,255,255,0.06);padding:12px 8px;border-radius:6px;font-size:14px;font-weight:700;color:#94a3b8}
.staircase-step.active{background:rgba(99,102,241,0.15);border-color:rgba(99,102,241,0.4);color:#818cf8}
.step-label{font-size:10px;font-weight:500;color:#64748b}

/* Exceptions */
.exceptions{margin-left:20px;font-size:12px;color:#94a3b8}
.exceptions li{margin-bottom:4px}
.exceptions strong{color:#cbd5e1}

/* Footer */
.footer{margin-top:36px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;color:#475569;font-size:11px}

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
          <th>Lokation</th><th>By</th><th>Kunde</th><th>Periode</th>
          <th class="num">Bookinger</th><th class="num">Dage</th><th class="num">Dagspris</th><th class="num">Beløb</th>
          ${isAnnualRevenue ? '<th class="num">Rabat</th><th class="num">Efter rabat</th>' : ""}
        </tr>
      </thead>
      <tbody>${locationRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="7">Subtotal</td>
          <td class="num">${fmtKr(config.totals.subtotal)}</td>
          ${isAnnualRevenue ? `<td class="num accent">-${fmtKr(config.totals.discountAmount)}</td><td class="num">${fmtKr(config.totals.finalAmount)}</td>` : ""}
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="section">
    <h3>Rabatberegning</h3>
    ${discountSectionHtml}
  </div>

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
