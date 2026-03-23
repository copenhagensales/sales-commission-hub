import type { ForecastResult } from "@/types/forecast";

interface ReportData {
  clientName: string;
  periodLabel: string;
  forecast: ForecastResult;
  forecastM2: ForecastResult | null;
  periodLabelM2: string;
  clientTarget?: number | null;
}

export function generateForecastReportPdf(data: ReportData) {
  const { clientName, periodLabel, forecast, forecastM2, periodLabelM2, clientTarget } = data;
  const churnTotal = forecast.churnLoss + (forecast.establishedChurnLoss || 0);
  const periodCohorts = forecast.cohorts.filter(c => c.startDate >= forecast.periodStart && c.startDate <= forecast.periodEnd);
  const cohortSales = periodCohorts.reduce((s, c) => s + c.forecastSales, 0);
  const numEmployees = forecast.establishedEmployees.length;
  const numCohorts = periodCohorts.filter(c => c.forecastSales > 0).length;

  const driverTexts: string[] = [];
  if (forecast.absenceLoss > 0) driverTexts.push(`Fravær reducerer med ${forecast.absenceLoss} salg`);
  if (churnTotal > 0) driverTexts.push(`Forventet naturlig udskiftning i teamet reducerer med ${churnTotal} salg`);
  const holidayDriver = forecast.drivers.find(d => d.key === "holidays");
  const holidayCount = holidayDriver ? parseInt(holidayDriver.value) || 0 : 0;
  if (holidayCount > 0) driverTexts.push(`${holidayCount} helligdage i perioden`);

  const positiveDrivers = forecast.drivers.filter(d => d.impact === "positive");
  const negativeDrivers = forecast.drivers.filter(d => d.impact === "negative");

  // Target diff
  let targetHtml = "";
  if (clientTarget && clientTarget > 0) {
    const diff = forecast.totalSalesExpected - clientTarget;
    const pct = Math.round((diff / clientTarget) * 100);
    const diffColor = diff >= 0 ? "#0BA360" : "#ef4444";
    const diffSign = diff >= 0 ? "+" : "";
    targetHtml = `
      <div style="display:flex;align-items:center;gap:10px;margin-top:12px;padding:10px 14px;background:#1e3a5f33;border-radius:8px;border:1px solid #1e3a5f;">
        <span style="font-size:14px;">🎯</span>
        <span style="font-size:13px;color:#e2e8f0;font-weight:600;">Kundetarget: ${clientTarget.toLocaleString("da-DK")} salg</span>
        <span style="background:${diffColor}22;color:${diffColor};font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;border:1px solid ${diffColor}44;">
          ${diffSign}${diff.toLocaleString("da-DK")} (${diffSign}${pct}%)
        </span>
      </div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <title>Salgsforecast – ${periodLabel} – ${clientName}</title>
  <style>
    @page { size: A4; margin: 16mm 18mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif; font-size: 11px; color: #e2e8f0; line-height: 1.55; background: #0f172a; }
    
    .accent-bar { height: 3px; background: linear-gradient(90deg, #0BA360, #0BA360aa, transparent); margin-bottom: 20px; border-radius: 2px; }
    
    .header { margin-bottom: 20px; }
    .header h1 { font-size: 22px; font-weight: 800; color: #f8fafc; letter-spacing: -0.3px; }
    .header .subtitle { font-size: 12px; color: #94a3b8; margin-top: 2px; }
    .header .date { font-size: 10px; color: #64748b; margin-top: 4px; }
    
    .card { background: #162032; border: 1px solid #1e3a5f; border-radius: 10px; padding: 18px; margin-bottom: 14px; }
    .card-highlight { border-color: #0BA36044; background: linear-gradient(135deg, #162032, #0f172a); }
    
    .section-title { font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
    .section-title::before { content: ''; display: inline-block; width: 3px; height: 14px; background: #0BA360; border-radius: 2px; }
    
    .big-number { font-size: 36px; font-weight: 800; color: #f8fafc; letter-spacing: -1px; }
    .big-sub { font-size: 13px; color: #94a3b8; margin-left: 8px; }
    
    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 6px; }
    .kpi-box { text-align: center; background: #1e293b; border: 1px solid #1e3a5f; border-radius: 8px; padding: 12px 8px; }
    .kpi-val { font-size: 20px; font-weight: 700; color: #f8fafc; }
    .kpi-lbl { font-size: 10px; color: #94a3b8; margin-top: 2px; font-weight: 500; }
    .kpi-sub { font-size: 9px; color: #64748b; margin-top: 1px; }
    
    .effect-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 8px; margin-bottom: 5px; }
    .effect-neg { background: #ef444410; border: 1px solid #ef444420; }
    .effect-pos { background: #0BA36010; border: 1px solid #0BA36020; }
    .effect-label { font-size: 11px; color: #e2e8f0; display: flex; align-items: center; gap: 6px; }
    .effect-value { font-size: 11px; font-weight: 700; }
    .neg { color: #ef4444; }
    .pos { color: #0BA360; }
    
    .driver-group-label { font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 6px; margin-top: 10px; }
    .driver-block { padding: 8px 12px; background: #1e293b; border-radius: 8px; margin-bottom: 5px; border-left: 3px solid #1e3a5f; }
    .driver-block.positive { border-left-color: #0BA360; }
    .driver-block.negative { border-left-color: #ef4444; }
    .driver-block strong { font-size: 11px; color: #f8fafc; }
    .driver-block p { font-size: 10px; color: #94a3b8; margin-top: 1px; }
    
    .outlook-box { background: #1e293b; border: 1px solid #1e3a5f; border-radius: 8px; padding: 14px; margin-bottom: 8px; }
    .outlook-box.tentative { border-style: dashed; border-color: #64748b; }
    .outlook-title { font-size: 12px; font-weight: 600; color: #f8fafc; text-transform: capitalize; }
    .outlook-val { font-size: 18px; font-weight: 700; color: #f8fafc; margin-top: 2px; }
    .outlook-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
    .warning { color: #f59e0b; font-size: 10px; margin-top: 6px; display: flex; align-items: center; gap: 4px; }
    
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; padding: 8px 10px; color: #94a3b8; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #1e3a5f; }
    td { padding: 8px 10px; border-bottom: 1px solid #1e293b; color: #e2e8f0; }
    
    .ramp-badge { background: #0BA36015; color: #0BA360; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 500; border: 1px solid #0BA36030; }
    
    .footer { text-align: center; color: #64748b; font-size: 9px; margin-top: 20px; padding-top: 12px; border-top: 1px solid #1e3a5f; }
    .footer::before { content: ''; display: block; width: 60px; height: 2px; background: #0BA360; margin: 0 auto 8px; border-radius: 1px; }
    
    .summary-text { font-size: 12px; color: #94a3b8; line-height: 1.6; max-width: 90%; }
    .interval { font-size: 11px; color: #64748b; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="accent-bar"></div>
  
  <div class="header">
    <h1>Salgsforecast – ${periodLabel}</h1>
    <div class="subtitle">${clientName}</div>
    <div class="date">Genereret ${new Date().toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })}</div>
  </div>

  <!-- Executive Summary -->
  <div class="card card-highlight">
    <div style="margin-bottom:6px;">
      <span class="big-number">${forecast.totalSalesExpected.toLocaleString("da-DK")}</span>
      <span class="big-sub">forventede salg</span>
    </div>
    <div class="interval">Interval: ${forecast.totalSalesLow.toLocaleString("da-DK")}–${forecast.totalSalesHigh.toLocaleString("da-DK")} salg</div>
    <p class="summary-text" style="margin-top:8px;">
      Forecastet er baseret på ${numEmployees} etablerede sælgere${numCohorts > 0 ? ` og ${numCohorts} opstartshold` : ""}.
    </p>
    ${targetHtml}
    ${driverTexts.length > 0 ? `<p class="summary-text" style="margin-top:8px;">De vigtigste faktorer: ${driverTexts.join(", ")}.</p>` : ""}
  </div>

  <!-- Nøgletal -->
  <div class="section-title">Nøgletal</div>
  <div class="card">
    <div class="kpi-grid">
      <div class="kpi-box">
        <div class="kpi-val">${forecast.totalSalesExpected.toLocaleString("da-DK")}</div>
        <div class="kpi-lbl">Forventet salg</div>
        <div class="kpi-sub">${forecast.totalSalesLow.toLocaleString("da-DK")}–${forecast.totalSalesHigh.toLocaleString("da-DK")}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-val">${Math.round(forecast.totalHeads)}</div>
        <div class="kpi-lbl">Aktive sælgere</div>
        <div class="kpi-sub">${numEmployees} etablerede</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-val">${Math.round(forecast.totalHours).toLocaleString("da-DK")}</div>
        <div class="kpi-lbl">Timer</div>
        <div class="kpi-sub">Justeret for fravær</div>
      </div>
    </div>
    ${forecast.absenceLoss > 0 ? `<div class="effect-row effect-neg"><span class="effect-label">▼ Fraværseffekt</span><span class="effect-value neg">-${forecast.absenceLoss} salg</span></div>` : ""}
    ${churnTotal > 0 ? `<div class="effect-row effect-neg"><span class="effect-label">▼ Teamudskiftning</span><span class="effect-value neg">-${churnTotal} salg</span></div>` : ""}
    ${cohortSales > 0 ? `<div class="effect-row effect-pos"><span class="effect-label">▲ Nye hold</span><span class="effect-value pos">+${cohortSales} salg</span></div>` : ""}
  </div>

  ${periodCohorts.filter(c => c.forecastSales > 0 || c.plannedHeadcount > 0).length > 0 ? `
  <div class="section-title">Planlagte opstartshold</div>
  <div class="card">
    <p style="font-size:11px;color:#94a3b8;margin-bottom:10px;">
      Der er planlagt ${periodCohorts.filter(c => c.forecastSales > 0 || c.plannedHeadcount > 0).length} opstartshold med i alt ${periodCohorts.filter(c => c.forecastSales > 0 || c.plannedHeadcount > 0).reduce((s, c) => s + c.plannedHeadcount, 0)} nye sælgere.
    </p>
    <table>
      <thead>
        <tr>
          <th>Startdato</th>
          <th style="text-align:center;">Antal</th>
          <th style="text-align:center;">Ramp-fase</th>
          <th style="text-align:right;">Forventet salg</th>
        </tr>
      </thead>
      <tbody>
        ${periodCohorts.filter(c => c.forecastSales > 0 || c.plannedHeadcount > 0).map(c => {
          const rampLabel = c.rampFactor <= 0.2 ? "Opstartsfase (15%)" : c.rampFactor <= 0.4 ? "Tidlig fase (35%)" : c.rampFactor <= 0.7 ? "Optrapning (60%)" : c.rampFactor <= 0.9 ? "Næsten fuld (85%)" : "Fuld kapacitet";
          return `<tr>
            <td>${new Date(c.startDate).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" })}</td>
            <td style="text-align:center;">${c.plannedHeadcount} sælgere</td>
            <td style="text-align:center;"><span class="ramp-badge">${rampLabel}</span></td>
            <td style="text-align:right;font-weight:700;">${c.forecastSales} salg</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>` : ""}

  <!-- Drivers -->
  <div class="section-title">Hvad driver forecastet</div>
  <div class="card">
    ${positiveDrivers.length > 0 ? `<div class="driver-group-label pos">▲ Positivt</div>${positiveDrivers.map(d => `<div class="driver-block positive"><strong>${d.label.replace(/churn/gi, "teamudskiftning")}</strong><p>${d.description.replace(/churn/gi, "udskiftning")}</p></div>`).join("")}` : ""}
    ${negativeDrivers.length > 0 ? `<div class="driver-group-label neg">▼ Negativt</div>${negativeDrivers.map(d => `<div class="driver-block negative"><strong>${d.label.replace(/churn/gi, "teamudskiftning")}</strong><p>${d.description.replace(/churn/gi, "udskiftning")}</p></div>`).join("")}` : ""}
    ${positiveDrivers.length === 0 && negativeDrivers.length === 0 ? `<p style="font-size:11px;color:#64748b;">Ingen særlige drivers identificeret.</p>` : ""}
  </div>

  <!-- Outlook -->
  <div class="section-title">Outlook</div>
  <div class="outlook-box">
    <div class="outlook-title">${periodLabel}</div>
    <div class="outlook-val">${forecast.totalSalesExpected.toLocaleString("da-DK")} salg</div>
    <div class="outlook-sub">Interval: ${forecast.totalSalesLow.toLocaleString("da-DK")}–${forecast.totalSalesHigh.toLocaleString("da-DK")}</div>
  </div>
  ${forecastM2 ? `
  <div class="outlook-box tentative">
    <div class="outlook-title">${periodLabelM2}</div>
    <div class="outlook-val">${forecastM2.totalSalesExpected.toLocaleString("da-DK")} salg</div>
    <div class="outlook-sub">Interval: ${forecastM2.totalSalesLow.toLocaleString("da-DK")}–${forecastM2.totalSalesHigh.toLocaleString("da-DK")}</div>
    <div class="warning">⚠ Retningsgivende — mere usikkert pga. længere tidshorisont.</div>
  </div>` : ""}

  <div class="footer">
    Salgsforecast er estimater og kan afvige fra faktiske resultater.
  </div>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=800,height=1100");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}
