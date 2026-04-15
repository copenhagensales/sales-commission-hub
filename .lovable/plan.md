

# CPO/time som omsætning — beregnet fra timer

## Overblik
CPO/time-satsen på stempelure skal generere omsætning automatisk: **timer × CPO-sats = omsætning**. Denne omsætning lægges oven i den eksisterende salgsomsætning i DB-oversigt, klient-DB og daglige breakdowns.

## Tilgang
I stedet for at ændre den centrale salgsaggregerings-hook (som kun handler om salg), opretter vi en dedikeret hook der beregner CPO-omsætning fra `time_stamps` + `employee_time_clocks`, og tilføjer resultatet i de komponenter der viser omsætning.

## Trin

### 1. Ny hook: `useCpoRevenue`
Opretter `src/hooks/useCpoRevenue.ts` der:
- Henter alle aktive `employee_time_clocks` med `cpo_per_hour > 0` for den givne periode/team/klient
- Henter `time_stamps` for de relevante medarbejdere i perioden
- Beregner `effective_hours × cpo_per_hour` per medarbejder og per dato
- Returnerer `{ totals, byEmployee, byDate }` med samme form som `AggregateData` (revenue-feltet)

### 2. Integrer CPO-omsætning i DB-oversigt
Opdaterer `DBOverviewTab.tsx`:
- Kalder `useCpoRevenue` med samme periode/team-filtre
- Lægger CPO-revenue oven i salgsrevenue per team-medlem ved DB-beregning
- Revenue-tallet i UI afspejler nu salg + CPO

### 3. Integrer i daglig breakdown
Opdaterer `DBDailyBreakdown.tsx`:
- Kalder `useCpoRevenue` grupperet per dato
- Lægger CPO-revenue til daglig revenue

### 4. Integrer i klient-DB
Opdaterer `ClientDBTab.tsx`:
- Tilføjer CPO-omsætning per klient baseret på `time_stamps.client_id`

### 5. Opdater memory
Opdaterer time-clock memory med den nye CPO-beregningslogik.

## Teknisk detalje
```text
time_stamps (med client_id)
    ↓ join via employee_id
employee_time_clocks (cpo_per_hour > 0)
    ↓
effective_hours × cpo_per_hour = CPO-omsætning
    ↓ tilføjes til
DB-beregning (revenue += cpo_revenue)
```

Hooken matcher `time_stamps.client_id` med `employee_time_clocks.client_id` OG `employee_id` for at finde den korrekte CPO-sats. Timer uden tilknyttet stempelur med CPO ignoreres.

