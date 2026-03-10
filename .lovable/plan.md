

# Tilføj team-sammenlignings graf til Onboarding Analyse

## Hvad
En bar chart der viser 60-dages churn % per team side om side, så man hurtigt kan sammenligne teams visuelt.

## Hvordan
- Tilføj en ny `Card` med en Recharts `BarChart` i `OnboardingAnalyse.tsx`, placeret mellem KPI-kort og per-team tabellen.
- Genbruger den allerede beregnede `teamStats` data (team, churn%, total, exits).
- Hver bar farves efter churn-niveau (grøn/gul/rød) via den eksisterende `getChurnBg` helper.
- X-akse: team-navne, Y-akse: churn %.
- Tooltip viser kohorte-størrelse og antal stoppet.
- En ReferenceLine ved den samlede `overallChurn` som benchmark.

## Fil
- `src/pages/OnboardingAnalyse.tsx` — tilføj ~40 linjer chart-sektion med Recharts BarChart.

