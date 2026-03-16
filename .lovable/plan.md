

## Automatisk statusskift for liga-sæsoner

### Tilgang
Tilføj auto-transition logik i `calculate-kpi-values` edge function, som allerede kører på cron og henter liga-sæsoner. Før den beregner KPIs, tjekker den om en sæson skal skifte status baseret på datoerne.

### Logik
- `draft` → `qualification`: Når `qualification_start_at <= now()` og `qualification_end_at > now()`
- `qualification` → `active`: Når `start_date <= now()` og `end_date > now()`  
- `active` → `completed`: Når `end_date < now()`

### Ændringer

**1. `supabase/functions/calculate-kpi-values/index.ts`**
- Tilføj en `autoTransitionSeasonStatuses()` funktion tidligt i flowet
- Henter alle sæsoner der IKKE er `completed`
- Tjekker datoer mod `now()` og opdaterer status + `is_active` flag
- Når en sæson sættes til `active`, deaktiveres andre aktive sæsoner (samme logik som den manuelle mutation)
- Logger eventuelle statusskift

**2. `src/components/league/SeasonManagerCard.tsx`**
- Vis en lille info-tekst under tabellen: "Status opdateres automatisk baseret på datoerne"

### Tekniske detaljer
- Kører ved hvert cron-kald (allerede scheduleret), så statusskift sker inden for et par minutter af den rette dato
- Ingen nye edge functions eller cron jobs nødvendige
- Ingen databaseændringer nødvendige

