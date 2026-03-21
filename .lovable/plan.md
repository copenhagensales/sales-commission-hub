

# Gør forecast-værktøjet mere værdifuldt og letaflæseligt

## Overordnet retning
Skift fra et "data-dump"-layout til en **narrativ, handlingsorienteret** oplevelse. Kunden skal kunne forstå forecastet på 10 sekunder og vide hvad de kan gøre ved det.

## Foreslåede forbedringer

### 1. Executive Summary — "Forecast på 10 sekunder"
Tilføj et fremhævet summary-panel øverst der forklarer forecastet i naturligt sprog:

> *"I april forventer vi **1.180 salg** fra 18 sælgere over 19 arbejdsdage. Det er 8% under marts pga. 3 helligdage i påsken og 2 medarbejdere under ramp-up. Største risiko: churn hos 3 nyansatte."*

- Genereres automatisk fra forecast-data (drivers, cohorts, aktuelle vs. forrige periode)
- Ingen AI nødvendig — ren template-logik med conditional tekst-blokke
- Vises i et Card med stort tal + undertekst

### 2. Visuel "Waterfall"-graf — Hvad bygger forecastet op
Erstat de 6 KPI-kort med en **waterfall-chart** der viser:

```text
Brutto-kapacitet (timer × SPH)  ████████████████████ 1.450
  - Fravær (ferie/sygdom)       ████                  -120
  - Churn-risiko                ██                     -85
  + Nye hold (ramp-up)          ███                    +65
  = Forventet salg              ████████████████      1.310
```

- Gør det intuitivt klart *hvor* salg forsvinder og *hvad* der bidrager
- Brug Recharts `BarChart` med positive/negative stacked bars
- KPI-kortene kan beholdes under som sekundær detalje

### 3. Progress-tracker for indeværende måned
For "Denne måned": vis en **progress bar** der viser:
- Faktiske salg vs. forecast med % completion
- "On track" / "Behind" / "Ahead" status-badge
- Simpel pace-indikator: "60 salg/dag behøves → I laver 63/dag"

### 4. Medarbejder risk-flagging i breakdown
Tilføj visuelle indikatorer i breakdown-tabellen:
- 🔴 Rød badge: "Under ramp" eller "Høj churn-risiko"
- 🟡 Gul badge: "Lav performance vs. team-gns"
- 🟢 Grøn: "Over team-gns"
- Gør tabellen sorterbar (klik på kolonnehoveder)

### 5. "Hvad kan du gøre?"-sektion
Tilføj actionable insights under drivers-panelet:
- "3 medarbejdere performer under 50% af team-gns → overvej coaching"
- "Påskeugen koster 180 salg → overvej ekstra vagter i uge 13/15"
- "2 nyansatte har 45% churn-risiko → fokusér onboarding"

Genereres med simple business rules (thresholds), ikke AI.

### 6. Sammenligning med forrige måned
Tilføj delta-pile (▲▼) på KPI-kort der viser ændring vs. forrige periode:
- "1.310 salg (▼ 8% vs. marts)"
- Kontekstualiserer tallet så kunden ved om det er godt eller dårligt

## Implementeringsplan (prioriteret)

| Prioritet | Feature | Fil(er) | Kompleksitet |
|-----------|---------|---------|--------------|
| 1 | Executive Summary panel | Ny: `ForecastSummary.tsx`, ændring i `Forecast.tsx` | Medium |
| 2 | Progress-tracker (indev. måned) | Ny: `ForecastProgressBar.tsx`, ændring i `Forecast.tsx` | Lav |
| 3 | Waterfall-chart | Ny: `ForecastWaterfallChart.tsx`, ændring i `Forecast.tsx` | Medium |
| 4 | Risk-badges i breakdown | Ændring i `ForecastBreakdownTable.tsx` | Lav |
| 5 | Delta vs. forrige måned | Ændring i `ForecastKpiCards.tsx` + hook | Medium |
| 6 | Actionable insights | Ny: `ForecastInsights.tsx` | Medium |

## Anbefaling
Start med **1 + 2 + 4** — de tre features der giver mest værdi med mindst arbejde. Waterfall og insights kan komme i næste iteration.

Skal jeg implementere alle 6, eller vil du prioritere en delmængde?

