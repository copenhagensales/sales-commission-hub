

## Plan: Forecast-baseret salgsmål i TeamGoals

### Mål
Når et team og en måned/år er valgt i "Opret teammål"-dialogen, beregnes et foreslået salgsmål baseret på forrige måneds salg/dag per medarbejder × antal vagter i den valgte måned.

### Beregningslogik

**For hver medarbejder i teamet:**

1. **Forrige måned**: Beregn antal "normale vagter" og antal salg (counts_as_sale)
2. **Salg/dag** = salg ÷ normale vagter i forrige måned
3. **Vagter i valgt måned** = antal normale vagter i den valgte måned
4. **Forecast for medarbejder** = salg/dag × vagter i valgt måned
5. **Team forecast** = sum af alle medarbejderes forecasts

**Normal vagt** = dag hvor vagt eksisterer (hierarki: `shift` → `employee_standard_shifts` → `team_standard_shifts/team_standard_shift_days`) OG IKKE godkendt fravær (sick/vacation/no_show).

### Tekniske ændringer

**Ny hook: `src/hooks/useTeamGoalForecast.ts`**
- Input: `teamId`, `month`, `year`
- Beregner `previousMonth` = valgt måned - 1
- Henter:
  - Team-medarbejdere via `team_members` + `employee_master_data` (is_active)
  - Agent emails via `employee_agent_mapping`
  - Salg i forrige måned via `useSalesAggregatesExtended` (counts_as_sale, groupBy employee)
  - Vagtdata: `shift`, `employee_standard_shifts`, `team_standard_shifts`, `team_standard_shift_days`
  - Fravær: `absence_request_v2` (approved, type in sick/vacation/no_show) for begge måneder
- Beregner normale vagter per medarbejder for begge måneder (genbruger hierarki-logikken fra `useKpiTest.ts` linje 609-816)
- Returnerer: `{ forecast: number, perEmployee: Array<{name, prevSales, prevShifts, salesPerDay, targetShifts, forecast}>, isLoading }`

**Ændring: `src/pages/TeamGoals.tsx`**
- Kald `useTeamGoalForecast(form.team_id, form.month, form.year)` i dialogen
- Vis forslaget som et badge/label under Salgsmål-feltet: "Foreslået: 342" med en "Anvend" knap
- Klik på "Anvend" sætter `form.sales_target` til forecast-værdien
- Vis eventuelt en tooltip/expandable med per-medarbejder breakdown

### UI
- Under `Salgsmål` inputfeltet vises (når forecast er loaded og > 0):
  ```
  💡 Foreslået mål: 342  [Anvend]
  ```
- Lille tekst: "Baseret på X medarbejderes salg/dag i [forrige måned]"

