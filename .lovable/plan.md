

# Fix: Forecast afskæres af 1000-rækkers grænse

## Problem
Salgsqueryen i SPH-beregningen (linje 160-166 i `useClientForecast.ts`) har ingen `.limit()`. Supabase returnerer maks 1000 rækker som standard. For teams med mange medarbejdere og 8 ugers salgsdata afskæres ældre rækker — herunder Rebeccas data fra januar/februar (hendes eneste aktive uger). Det giver SPH ≈ 0 → forecast = 12 i stedet for ~60.

Samme problem eksisterer i den aktuelle-salg query (linje 601-607).

## Løsning
Tilføj `.limit(10000)` på begge salgsqueries for at sikre at alle rækker returneres.

## Ændringer

### `src/hooks/useClientForecast.ts`
1. **Linje 166**: Tilføj `.limit(10000)` til EWMA-salgsqueryen
2. **Linje 607**: Tilføj `.limit(10000)` til aktuel-salg queryen

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Tilføj `.limit(10000)` på 2 salgsqueries |

