# TDC Månedsmål: sælgerliste i to kolonner

## Problem
Listen med individuelle mål er for lang til at kunne ses på TV-skærmen uden scroll.

## Løsning
Ren layout-ændring i `src/pages/dashboards/TdcMonthlyGoalBoard.tsx`:

- Erstat den nuværende `space-y-4` liste med et grid: én kolonne på små skærme, to kolonner fra `md` og op (`grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4`).
- Rækkefølgen bevares (sorteret efter progress) og fyldes kolonnevis fra venstre mod højre.
- Komprimér hver række let, så begge kolonner er synlige uden scroll: lidt mindre tekststørrelse og tyndere progress-bar.

Ingen ændringer i data, hook (`useTdcMonthlyGoal`), mål-konfiguration eller edge function.

## Filer
- `src/pages/dashboards/TdcMonthlyGoalBoard.tsx` (grøn zone, kun styling/layout)
