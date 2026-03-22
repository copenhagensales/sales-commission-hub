

# Kundevendt Forecast-rapport — Plan

## Vurdering af forslaget

ChatGPT-forslaget er godt og matcher næsten 1:1 med det, I allerede har bygget. Executive Summary, KPI'er, Drivers, Insights/Anbefalinger og Waterfall eksisterer allerede som komponenter. Det reelle arbejde er:

1. En **ny side/visning** der genbruger forecast-data men præsenterer dem i kundevendt sprog (ingen medarbejdernavne, ingen EWMA/SPH-jargon)
2. **PDF-eksport** via print-til-PDF (samme mønster som kontrakter og leverandørrapporter)
3. **Outlook +2 måneder** (udvid hooken med `monthOffset`)

## Implementering

### 1. Ny side: `/forecast/rapport`

Ny side `src/pages/ForecastClientReport.tsx` med kundevendt layout:

- **Sektioner**: Executive Summary → Nøgletal → Drivers → Anbefalinger → Outlook
- **Datakilde**: Genbruger `useClientForecast` — henter forecast for valgt kunde + periode
- Ingen medarbejdernavne, ingen SPH, ingen EWMA — alt formuleret i naturligt sprog
- Kundevalg + periodevalg i toppen
- "Download PDF"-knap i header

### 2. PDF-eksport

Ny `src/utils/forecastReportPdfGenerator.ts` — samme print-window-mønster som `contractPdfGenerator.ts` og `supplierReportPdfGenerator.ts`:
- Åben popup med stylet HTML (A4 portrait, 1 side)
- Sektioner: header med kundenavn + periode, executive summary, nøgletal-tabel, drivers, anbefalinger
- `window.print()` for at gemme som PDF

### 3. Udvid hook med `monthOffset`

I `useClientForecast.ts`:
- Erstat `period: "current" | "next"` med `monthOffset: number` (0 = denne md, 1 = næste, 2 = +2)
- For `monthOffset >= 2`: tilføj en usikkerhedsfaktor (fx bredere interval) og marker som "retningsgivende"
- Backward-compatible: Forecast.tsx bruger stadig 0/1

### 4. Routing

Tilføj `/forecast/rapport` route i App.tsx med adgangskontrol.

## Filer

| Fil | Ændring |
|-----|---------|
| `src/pages/ForecastClientReport.tsx` | Ny side med kundevendt rapport-layout |
| `src/utils/forecastReportPdfGenerator.ts` | Ny PDF-generator (print-window) |
| `src/hooks/useClientForecast.ts` | Udvid med `monthOffset` (0/1/2) |
| `src/App.tsx` | Tilføj route |
| `src/pages/Forecast.tsx` | Tilføj link til kunderapport |

## Hvad der IKKE ændres
- Forecast-motoren (`forecast.ts`) — fungerer allerede
- Eksisterende forecast-side — forbliver som intern visning
- Eksisterende komponenter — genbruges ikke direkte (kundeversionen har sit eget layout)

