

# Omformuler churn-sprog til kundevendt tone

## Problem
Rapporten nævner "churn-risiko" og "forhøjet churn-risiko" direkte — det er negativt og internt jargon, uegnet til kunder.

## Ændringer i `src/pages/ForecastClientReport.tsx`

**4 steder skal omformuleres:**

1. **Executive Summary (linje 157)**: `"churn-risiko trækker X salg"` → `"forventet naturlig udskiftning i teamet reducerer med X salg"`

2. **Nøgletal negativ-effekt (linje 218)**: Label `"Churn-effekt"` → `"Teamudskiftning"`, desc `"Forventet medarbejderafgang"` → `"Indregnet naturlig udskiftning i teamet"`

3. **Anbefalinger (linje 336-343)**: Fjern "forhøjet churn-risiko". Omskriv til:
   - Titel: `"Fastholdelse"` (beholdes)
   - Tekst: `"Vi har indregnet en forventet naturlig udskiftning i teamet svarende til X salg. Tæt lederkontakt og tidlig opfølgning kan reducere denne effekt."`

4. **Drivers-sektionen (linje 289+)**: Churn-driveren fra `forecast.drivers` — her bruges `d.label` og `d.description` fra backend. Disse genereres i `forecast.ts`, men i kunderapporten bør vi override labels der indeholder "churn" med kundevendt sprog.

Også i **`src/utils/forecastReportPdfGenerator.ts`** — samme omformulering af churn-tekster i PDF-versionen.

| Fil | Ændring |
|-----|---------|
| `src/pages/ForecastClientReport.tsx` | Omformuler alle churn-referencer til "naturlig udskiftning i teamet" |
| `src/utils/forecastReportPdfGenerator.ts` | Samme omformulering i PDF |

