import type { ForecastResult } from "@/types/forecast";

interface ReportData {
  clientName: string;
  periodLabel: string;
  forecast: ForecastResult;
  forecastM2: ForecastResult | null;
  periodLabelM2: string;
}

export function generateForecastReportPdf(data: ReportData) {
  const { clientName, periodLabel, forecast, forecastM2, periodLabelM2 } = data;
  const churnTotal = forecast.churnLoss + (forecast.establishedChurnLoss || 0);
  const cohortSales = forecast.cohorts.reduce((s, c) => s + c.forecastSales, 0);
  const numEmployees = forecast.establishedEmployees.length;
  const numCohorts = forecast.cohorts.filter(c => c.forecastSales > 0).length;

  const driverTexts: string[] = [];
  if (forecast.absenceLoss > 0) driverTexts.push(`Fravær reducerer med ${forecast.absenceLoss} salg`);
  if (churnTotal > 0) driverTexts.push(`Forventet naturlig udskiftning i teamet reducerer med ${churnTotal} salg`);
  const holidayDriver = forecast.drivers.find(d => d.key === "holidays");
  const holidayCount = holidayDriver ? parseInt(holidayDriver.value) || 0 : 0;
  if (holidayCount > 0) driverTexts.push(`${holidayCount} helligdage i perioden`);

  const positiveDrivers = forecast.drivers.filter(d => d.impact === "positive");
  const negativeDrivers = forecast.drivers.filter(d => d.impact === "negative");

  // Build recommendations
  const recs: string[] = [];
  const highChurn = forecast.establishedEmployees.filter(e => e.churnProbability > 0.3);
  if (churnTotal > 0) {
    recs.push(`<strong>Fastholdelse:</strong> Vi har indregnet en forventet naturlig udskiftning i teamet svarende til ${churnTotal} salg. Tæt lederkontakt og tidlig opfølgning kan reducere denne effekt.`);
  }
  if (forecast.absenceLoss > 15) {
    recs.push(`<strong>Fravær:</strong> Fravær koster ${forecast.absenceLoss} salg. Se på planlægning, vikardækning eller mønstre.`);
  }
  const avgSph = numEmployees > 0 ? forecast.establishedEmployees.reduce((s, e) => s + e.expectedSph, 0) / numEmployees : 0;
  const lowPerf = forecast.establishedEmployees.filter(e => e.expectedSph < avgSph * 0.5 && e.expectedSph > 0);
  if (lowPerf.length > 0) {
    recs.push(`<strong>Performance-løft:</strong> ${lowPerf.length} sælger${lowPerf.length > 1 ? "e" : ""} performer under teamgennemsnittet. Coaching kan løfte output.`);
  }

  const html = `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <title>Salgsforecast – ${periodLabel} – ${clientName}</title>
  <style>
    @page { size: A4; margin: 20mm 18mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #1a1a2e; line-height: 1.5; }
    .header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #e2e8f0; }
    .header h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .header p { color: #64748b; font-size: 12px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 13px; font-weight: 700; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
    .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .big-number { font-size: 32px; font-weight: 800; color: #1e40af; }
    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px; }
    .kpi-box { text-align: center; background: #f1f5f9; border-radius: 6px; padding: 10px; }
    .kpi-box .val { font-size: 18px; font-weight: 700; }
    .kpi-box .lbl { font-size: 10px; color: #64748b; }
    .effect-row { display: flex; justify-content: space-between; padding: 6px 10px; border-radius: 6px; margin-bottom: 4px; }
    .effect-neg { background: #fef2f2; }
    .effect-pos { background: #f0fdf4; }
    .effect-label { font-size: 11px; }
    .effect-value { font-size: 11px; font-weight: 700; }
    .neg { color: #dc2626; }
    .pos { color: #16a34a; }
    .driver-block { margin-bottom: 6px; }
    .driver-block strong { font-size: 11px; }
    .driver-block p { font-size: 10px; color: #64748b; }
    .rec-item { padding-left: 12px; border-left: 3px solid #3b82f6; margin-bottom: 8px; }
    .outlook-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 8px; }
    .outlook-box.tentative { border-style: dashed; }
    .warning { color: #d97706; font-size: 10px; margin-top: 4px; }
    .footer { text-align: center; color: #94a3b8; font-size: 9px; margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Salgsforecast – ${periodLabel}</h1>
    <p>Forventning for den kommende periode for ${clientName}</p>
  </div>

  <div class="section">
    <div class="summary-box">
      <div style="margin-bottom: 8px;">
        <span class="big-number">${forecast.totalSalesExpected.toLocaleString("da-DK")}</span>
        <span style="font-size: 13px; color: #64748b; margin-left: 8px;">forventede salg</span>
      </div>
      <p>Forecastet er baseret på ${numEmployees} etablerede sælgere${numCohorts > 0 ? ` og ${numCohorts} opstartshold` : ""}. Det forventede interval er ${forecast.totalSalesLow.toLocaleString("da-DK")}–${forecast.totalSalesHigh.toLocaleString("da-DK")} salg.</p>
      ${driverTexts.length > 0 ? `<p style="margin-top: 6px;">De vigtigste faktorer: ${driverTexts.join(", ")}.</p>` : ""}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Nøgletal</div>
    <div class="kpi-grid">
      <div class="kpi-box"><div class="val">${forecast.totalSalesExpected.toLocaleString("da-DK")}</div><div class="lbl">Forventet salg</div></div>
      <div class="kpi-box"><div class="val">${Math.round(forecast.totalHeads)}</div><div class="lbl">Aktive sælgere</div></div>
      <div class="kpi-box"><div class="val">${Math.round(forecast.totalHours).toLocaleString("da-DK")}</div><div class="lbl">Timer</div></div>
    </div>
    ${forecast.absenceLoss > 0 ? `<div class="effect-row effect-neg"><span class="effect-label">Fraværseffekt</span><span class="effect-value neg">-${forecast.absenceLoss} salg</span></div>` : ""}
    ${churnTotal > 0 ? `<div class="effect-row effect-neg"><span class="effect-label">Teamudskiftning</span><span class="effect-value neg">-${churnTotal} salg</span></div>` : ""}
    ${cohortSales > 0 ? `<div class="effect-row effect-pos"><span class="effect-label">Nye hold</span><span class="effect-value pos">+${cohortSales} salg</span></div>` : ""}
  </div>

  <div class="section">
    <div class="section-title">Hvad driver forecastet</div>
    ${positiveDrivers.length > 0 ? `<p style="font-size:10px;font-weight:600;color:#16a34a;margin-bottom:4px;">POSITIVT</p>${positiveDrivers.map(d => `<div class="driver-block"><strong>${d.label}</strong><p>${d.description}</p></div>`).join("")}` : ""}
    ${negativeDrivers.length > 0 ? `<p style="font-size:10px;font-weight:600;color:#dc2626;margin-bottom:4px;margin-top:8px;">NEGATIVT</p>${negativeDrivers.map(d => `<div class="driver-block"><strong>${d.label}</strong><p>${d.description}</p></div>`).join("")}` : ""}
  </div>

  ${recs.length > 0 ? `
  <div class="section">
    <div class="section-title">Anbefalinger</div>
    <p style="margin-bottom:8px;font-size:11px;color:#64748b;">Vi anbefaler at fokusere på:</p>
    ${recs.map(r => `<div class="rec-item"><p style="font-size:11px;">${r}</p></div>`).join("")}
  </div>` : ""}

  <div class="section">
    <div class="section-title">Outlook</div>
    <div class="outlook-box">
      <strong style="text-transform:capitalize;">${periodLabel}</strong>
      <div style="font-size:16px;font-weight:700;">${forecast.totalSalesExpected.toLocaleString("da-DK")} salg</div>
      <div style="font-size:10px;color:#64748b;">Interval: ${forecast.totalSalesLow.toLocaleString("da-DK")}–${forecast.totalSalesHigh.toLocaleString("da-DK")}</div>
    </div>
    ${forecastM2 ? `
    <div class="outlook-box tentative">
      <strong style="text-transform:capitalize;">${periodLabelM2}</strong>
      <div style="font-size:16px;font-weight:700;">${forecastM2.totalSalesExpected.toLocaleString("da-DK")} salg</div>
      <div style="font-size:10px;color:#64748b;">Interval: ${forecastM2.totalSalesLow.toLocaleString("da-DK")}–${forecastM2.totalSalesHigh.toLocaleString("da-DK")}</div>
      <div class="warning">⚠ Retningsgivende — mere usikkert pga. længere tidshorisont.</div>
    </div>` : ""}
  </div>

  <div class="footer">
    Genereret ${new Date().toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })} • Salgsforecast er estimater og kan afvige fra faktiske resultater.
  </div>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=800,height=1100");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}
