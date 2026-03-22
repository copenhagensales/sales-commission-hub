

# Team-KPI-kort på forecast-oversigten

## Idé
Når man åbner forecast-siden (især med "Alle kunder"), vises et grid af **team-kort** øverst der giver et hurtigt overblik: forventet salg, antal sælgere, status (on track / behind / ahead) — per team. Man kan klikke et kort for at filtrere til det team.

## Ny komponent: `ForecastTeamOverview.tsx`

Grupperer `forecast.establishedEmployees` efter `teamName` og beregner per team:
- **Forventet salg** (sum af `forecastSales`)
- **Antal sælgere** (count, ekskl. `missingAgentMapping`)
- **Gns. SPH** (gennemsnit af `expectedSph`)
- **Status-badge**: For indeværende måned — sammenligner `actualSales` vs. forventet pace → "On track" / "Foran" / "Bagud"
- **Fraværs-tab** (sum af churnLoss + absence-relateret tab per team)

Hvert kort er et kompakt Card med team-navn, stort tal (forventet salg), og en farvet status-indikator.

## Ændring i `Forecast.tsx`

Indsæt `<ForecastTeamOverview>` mellem Executive Summary og KPI Cards (linje ~193). Vises kun når der er mere end 1 team. Evt. klikbar: sætter et team-filter der highlighter det pågældende team i breakdown-tabellen.

## Andre forslag til hurtigt overblik

Disse kan implementeres som fase 2:
- **Mini-sparklines** på hvert team-kort der viser salgsudvikling de sidste 4 uger
- **"Største risiko"-flag** — det team med højest samlet churn/fravær-tab fremhæves

## Filer

| Fil | Ændring |
|-----|---------|
| `src/components/forecast/ForecastTeamOverview.tsx` | Ny komponent: team-grid med KPI-kort |
| `src/pages/Forecast.tsx` | Indsæt team-oversigt mellem summary og KPI cards |

