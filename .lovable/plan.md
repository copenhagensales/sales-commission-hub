

# Problem: Rebecca viser stadig 12 salg

## Diagnose
`.limit(10000)` er korrekt implementeret i koden. Rebeccas data (133 salg i jan/feb) burde give en EWMA-SPH på ~1.7-2.0 og et forecast på ~50-60 salg for de resterende 4 arbejdsdage.

**To mulige årsager:**

1. **Browser cache**: React Query har `staleTime: 5 min` og `refetchOnWindowFocus: false`. Prøv at trykke refresh-knappen på forecast-siden, eller hard-refresh browseren (Ctrl+Shift+R).

2. **Reelt dataproblem**: Hvis refresh ikke hjælper, kan Rebeccas `work_email` fallback ikke matche den email salget er registreret under. Jeg foreslår at tilføje console-logging midlertidigt for at debugge hendes specifikke beregning.

## Foreslået handling
1. Først: Prøv at refreshe forecast-siden med refresh-knappen
2. Hvis 12 stadig vises: Jeg tilføjer midlertidig debug-logging i `useClientForecast.ts` der printer Rebeccas SPH-data, så vi kan se præcist hvad der sker

Vil du prøve at refreshe først, eller skal jeg tilføje debug-logging direkte?
