/**
 * Utility to generate and download a supplier report as PDF
 * Uses browser's print-to-PDF functionality
 */

interface LocationRow {
  locationName: string;
  city: string;
  client: string;
  period: string;
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
        <td>
          ${loc.locationName}
          ${loc.isExcluded ? ' <span class="badge badge-excluded">Udelukket</span>' : ""}
          ${loc.maxDiscount != null && !loc.isExcluded ? ` <span class="badge badge-max">Max ${loc.maxDiscount}%</span>` : ""}
        </td>
        <td>${loc.city || "-"}</td>
        <td>${loc.client || "-"}</td>
        <td>${loc.period}</td>
        <td class="num">${loc.days}</td>
        <td class="num">${typeof loc.dailyRate === "number" ? fmtKr(loc.dailyRate) : loc.dailyRate}</td>
        <td class="num">${fmtKr(loc.amount)}</td>
        ${
          isAnnualRevenue
            ? `<td class="num discount">${loc.isExcluded ? '<span class="muted">Separat</span>' : `-${loc.discount}%`}</td>
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
        <table class="staircase-table">
          <tr>
            ${config.discountInfo.staircaseSteps
              .map(
                (s) =>
                  `<td class="${config.discountInfo.ytdRevenue != null && config.discountInfo.ytdRevenue >= s.minRevenue ? "active" : ""}">${s.discountPercent}%<br><small>${fmtKr(s.minRevenue)}+</small></td>`
              )
              .join("")}
          </tr>
        </table>
      </div>`
      : "";

  const discountSectionHtml = isAnnualRevenue
    ? `
      <div class="summary-grid">
        <div><span class="label">Kumulativ årsomsætning</span><span class="value">${fmtKr(config.discountInfo.ytdRevenue ?? 0)}</span></div>
        <div><span class="label">Nuværende rabattrin</span><span class="value">${config.discountInfo.discountPercent > 0 ? `${config.discountInfo.discountPercent}%` : "Ingen"}</span></div>
        <div><span class="label">Samlet rabat (denne md)</span><span class="value discount">-${fmtKr(config.totals.discountAmount)}</span></div>
        <div><span class="label">Total efter rabat</span><span class="value bold">${fmtKr(config.totals.finalAmount)}</span></div>
      </div>
      ${staircaseHtml}`
    : `
      <div class="summary-grid">
        <div><span class="label">Bookinger</span><span class="value">${config.discountInfo.uniquePlacements}</span></div>
        <div><span class="label">Rabattrin</span><span class="value">${config.discountInfo.discountPercent > 0 ? `${config.discountInfo.discountPercent}%` : "Ingen"}</span></div>
        <div><span class="label">Rabatbeløb</span><span class="value discount">-${fmtKr(config.totals.discountAmount)}</span></div>
        <div><span class="label">Total efter rabat</span><span class="value bold">${fmtKr(config.totals.finalAmount)}</span></div>
      </div>`;

  const html = `<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="UTF-8">
<title>Leverandørrapport – ${config.locationType} – ${config.month}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.5;color:#1a1a1a;padding:32px;max-width:900px;margin:0 auto;font-size:13px}
.header{border-bottom:2px solid #222;padding-bottom:16px;margin-bottom:24px}
.header h1{font-size:20px;margin-bottom:4px}
.header .meta{color:#666;font-size:13px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;font-size:12px}
th{background:#f5f5f5;font-weight:600}
.num{text-align:right}
tfoot td{font-weight:700;background:#fafafa}
.excluded{opacity:.55}
.badge{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:500;margin-left:4px}
.badge-excluded{background:#fee2e2;color:#991b1b}
.badge-max{background:#e0e7ff;color:#3730a3}
.discount{color:#16a34a}
.muted{color:#999;font-style:italic;font-size:11px}
.section{margin-bottom:20px}
.section h3{font-size:15px;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:4px}
.exceptions{margin-left:20px;font-size:12px}
.exceptions li{margin-bottom:2px}
.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px}
.summary-grid div{background:#f9f9f9;padding:10px;border-radius:6px}
.summary-grid .label{display:block;font-size:11px;color:#666}
.summary-grid .value{display:block;font-size:18px;font-weight:700;margin-top:2px}
.summary-grid .bold{font-weight:800}
.staircase{margin-top:12px}
.staircase h4{font-size:13px;margin-bottom:6px}
.staircase-table td{text-align:center;background:#f3f4f6;border:1px solid #ddd;padding:8px;font-size:12px;font-weight:600}
.staircase-table td.active{background:#dbeafe;border-color:#93c5fd}
.footer{margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;color:#aaa;font-size:11px}
@media print{body{padding:16px}}
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
          <th class="num">Dage</th><th class="num">Dagspris</th><th class="num">Beløb</th>
          ${isAnnualRevenue ? '<th class="num">Rabat</th><th class="num">Efter rabat</th>' : ""}
        </tr>
      </thead>
      <tbody>${locationRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="6">Subtotal</td>
          <td class="num">${fmtKr(config.totals.subtotal)}</td>
          ${isAnnualRevenue ? `<td class="num discount">-${fmtKr(config.totals.discountAmount)}</td><td class="num">${fmtKr(config.totals.finalAmount)}</td>` : ""}
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
