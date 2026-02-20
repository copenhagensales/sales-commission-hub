
# Tilføj fridage til ferie-kolonnen i Team Performance

## Problem
I Team Performance-tabellen tælles kun fravær af typen "vacation" (ferie) under Ferie-kolonnen. Fraværstypen "day_off" (fridag) bliver ignoreret og tælles hverken under Syg eller Ferie.

## Løsning
Opdater filtreringslogikken i `CphSalesDashboard.tsx` (linje 749-751) så "day_off" tælles sammen med "vacation" i ferie-kolonnen. Opdater også tooltip-tekst i `TeamPerformanceTabs.tsx` til at sige "ferie-/fridage" i stedet for "feriedage".

## Ændringer

### 1. `src/pages/dashboards/CphSalesDashboard.tsx`
- Linje 749-751: Udvid betingelsen så `day_off` inkluderes sammen med `vacation`:
  - `const isVacation = absence.type === "vacation" || absence.type === "day_off";`
  - Fjern den tidlige `return` der skipper ukendte typer (så `day_off` ikke filtreres fra)

### 2. `src/components/dashboard/TeamPerformanceTabs.tsx`
- Opdater kolonne-header fra "Ferie" til "Ferie/fri" (linje 130)
- Opdater tooltip-tekst fra "feriedage" til "ferie-/fridage" (linje 218, 277)

### 3. RPC-funktionen `get_team_performance_summary`
- Tjek om RPC-funktionen også filtrerer på `type = 'vacation'` og opdater den til at inkludere `day_off` - dette sikrer konsistens mellem klient-side og server-side beregninger.
