

# Fejl: Cohort-baseline SPH er forkert — bruger globalt gennemsnit

## Problem
Linje 680-688 i `useClientForecast.ts` beregner `baselineSph` som gennemsnittet af **alle** etablerede sælgeres SPH. Denne bruges direkte som `campaignBaselineSph` for cohorts (linje 701).

Hvis f.eks. TDC-sælgere har høj SPH, trækker det gennemsnittet op, og nye Eesy TM-hold forecaster med en SPH der ikke matcher Eesy TM's virkelighed.

### Eksempel-beregning med nuværende kode
Antag `baselineSph = 0.7` (globalt gennemsnit), `dailyHours = 5.29`, `attendance = 0.92`:

**Hold 1 (7 pers, start 31/3, 30 aktive dage i april):**
- Dag 1-7: 7 × 0.95 survival × 5.29 × 0.92 × 0.7 × 0.65 = ~14.5 salg
- Dag 8-14: 7 × 0.85 survival × 5.29 × 0.92 × 0.7 × 0.95 = ~19.4 salg
- Dag 15-30: 7 × ~0.67 survival × 5.29 × 0.92 × 0.7 × 1.0 × 16 dage = ~29.2 salg
- **Total hold 1: ~63 salg**

Men empirisk laver de ~41 salg/måned ved steady state (uge 3-4). Det indikerer en reel SPH på ~0.26, ikke 0.7.

## Løsning
Beregn `campaignBaselineSph` **pr. kampagne** i stedet for globalt:

1. I `useClientForecast.ts`: Når cohort har et `client_campaign_id`, beregn baseline kun fra etablerede sælgere tilknyttet **den kampagnes teams**
2. Fallback til globalt gennemsnit kun når ingen kampagne-specifikke sælgere findes
3. Brug `teamCampaignMap` (som allerede eksisterer) til at filtrere

### Ændringer
- **`src/hooks/useClientForecast.ts`** (~15 linjer):
  - Byg et map `campaignId → avgSph` fra etablerede sælgere
  - I `cohortInputs.map()`: brug kampagne-specifik SPH hvis tilgængelig
  - Log/eksponér den brugte baseline i cohort-resultatet (allerede understøttet via `baselineSph` i `CohortForecastResult`)

## Effekt
Eesy TM-cohorts bruger Eesy TM-sælgeres faktiske SPH i stedet for et oppustet globalt gennemsnit. Forecast-tallet falder markant og matcher den empiriske ~41 salg/måned ved steady state.

