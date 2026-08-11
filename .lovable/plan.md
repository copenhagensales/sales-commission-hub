# Ret "14 spillere pr. division" i UI

## Svar kort
Nej, det er ikke bevidst. Sæson 4 er oprettet med `players_per_division: 10` (samme som sæson 2 og 3). Tallet 14 er hardkodet tekst i UI'et fra sæson 1, hvor divisionerne var på 14 spillere. Databasen er korrekt — teksten er forkert.

## Evidens
- `src/pages/CommissionLeague.tsx:553` — teksten `14 spillere pr. division` er skrevet direkte i JSX.
- `src/components/league/LeagueRulesSheet.tsx:86` — samme tal skrevet direkte i reglerne.
- `src/pages/CommissionLeague.tsx:272` — den rigtige værdi læses allerede: `season?.config?.players_per_division || 10`.

## Ændringer
1. `CommissionLeague.tsx:553`: brug `playersPerDivision` (variablen findes allerede i samme komponent) i stedet for tallet 14.
2. `LeagueRulesSheet.tsx`: send sæsonens `players_per_division` ind (eller læs sæsonen i komponenten) og brug værdien i regelteksten, så den følger sæsonen.

Ingen ændring af data, config, edge functions eller pointberegning.

## Note (ikke del af denne opgave)
`supabase/functions/league-process-round/index.ts:98` har fallback `config.players_per_division || 14`, mens frontend har fallback 10. Sæson 4 har værdien sat eksplicit, så det påvirker intet nu, men de to fallbacks bør på sigt være ens. Sig til, hvis du vil have det med.
