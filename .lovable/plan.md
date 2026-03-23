

# Tilføj kundetarget til Kunderapport og PDF

## Hvad
Vis kundetarget i kunderapporten (ForecastClientReport) og inkluder det i den downloadbare PDF.

## Ændringer

| Fil | Hvad |
|-----|------|
| `src/pages/ForecastClientReport.tsx` | Tilføj query til `client_monthly_targets` for valgt kunde/periode. Vis target i `ReportExecutiveSummary` (som på Forecast-siden: "Kundetarget: X salg" med diff-badge). Send `clientTarget` til `generateForecastReportPdf`. |
| `src/utils/forecastReportPdfGenerator.ts` | Udvid `ReportData` med `clientTarget?: number \| null`. Tilføj en target-linje i summary-boksen der viser "Kundetarget: X salg" med afvigelse (forecast vs target) i parentes. |

## Teknisk detalje

**ForecastClientReport.tsx:**
- Beregn `periodStart` fra `monthOffset` (samme logik som Forecast.tsx)
- Query `client_monthly_targets` med `client_id` + `period_start`
- Vis i `ReportExecutiveSummary`: Target-ikon + "Kundetarget: {target} salg" + grøn/rød badge med diff
- Send `clientTarget` med til `generateForecastReportPdf`

**PDF:**
- Under summary-boksens interval-tekst, tilføj linje: "Kundetarget: X salg (forecast afviger +Y / -Y%)"
- Kun vist når `clientTarget > 0`

