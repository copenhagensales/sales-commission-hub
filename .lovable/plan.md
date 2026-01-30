
# Plan: Ret United Dashboard TV Mode Data

## Problem
TV-versionen af United dashboardet viser "Ingen salg" og 0 i alle KPI-kort, mens den normale browser-version viser korrekt data (877 salg denne uge, 1705 i lønperiode, osv.).

## Root Cause
Alle data-queries i `UnitedDashboard.tsx` er deaktiveret i TV mode med `enabled: !tvMode`:

1. **Team ID query** (linje 134): `enabled: !tvMode` → `unitedTeamId` er `null` i TV mode
2. **Leaderboards** (linje 145): `enabled: !tvMode && !!unitedTeamId` → dobbelt deaktiveret
3. **Client sales** (linje 220): `enabled: !tvMode` → ingen opgave-data
4. **Client hours** (linje 312): `enabled: !tvMode` → ingen timer-data
5. **Avatars** (linje 333): `enabled: !tvMode` → ingen avatars

## Løsning
Opdater `UnitedDashboard.tsx` til at hente data i **begge** modes (ligesom TdcErhvervDashboard gør):

### Tekniske ændringer

1. **Team ID query** - Fjern `!tvMode` betingelse:
   ```typescript
   // FØR:
   enabled: !tvMode
   
   // EFTER:
   enabled: true
   ```

2. **Cached Leaderboards** - Fjern `!tvMode` betingelse:
   ```typescript
   // FØR:
   { enabled: !tvMode && !!unitedTeamId, limit: 30 }
   
   // EFTER:
   { enabled: !!unitedTeamId, limit: 30 }
   ```

3. **Client sales data** - Fjern `!tvMode` betingelse:
   ```typescript
   // FØR:
   enabled: !tvMode && !!teamClients && teamClients.length > 0
   
   // EFTER:
   enabled: !!teamClients && teamClients.length > 0
   ```

4. **Client hours queries** - Fjern `!tvMode` betingelse:
   ```typescript
   // FØR:
   enabled: !tvMode && !!teamClients && teamClients.length > 0
   
   // EFTER:
   enabled: !!teamClients && teamClients.length > 0
   ```

5. **Employee avatars** - Fjern `!tvMode` betingelse:
   ```typescript
   // FØR:
   enabled: !tvMode
   
   // EFTER:
   enabled: true
   ```

## Påvirkede filer
- `src/pages/UnitedDashboard.tsx` (5 ændringer)

## Hvorfor dette virker
TdcErhvervDashboard og andre dashboards bruger `kpi_leaderboard_cache` tabellen, som har en public RLS policy der tillader læseadgang uden auth. Ved at fjerne `!tvMode` betingelserne vil United dashboardet kunne hente cached data via de samme mekanismer.

## Test
Efter ændringen vil TV link med koden "8T9N" vise:
- Korrekte KPI-tal (877 uge, 1705 løn osv.)
- Sælger-leaderboards med data
- "Salg per opgave" sektion med opgave-breakdown
