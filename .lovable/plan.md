

## Problem

United TV-dashboardet viser **0 i alle KPI'er og tomme leaderboards** ("Ingen salg endnu") fordi der **ikke findes nogen team-scoped cache** i systemet.

### Konkret datafund

**Tabel `kpi_leaderboard_cache`:**
| scope_type | rows |
|---|---|
| `global` | 3 |
| `client` | 42 |
| **`team`** | **0** ← bug |

**Tabel `kpi_cached_values`:** samme mønster — kun `global` og `client`, ingen `team` scope.

United er det eneste team-scoped dashboard (alle andre — Eesy TM, TDC Erhverv, Relatel etc. — er client-scoped og virker fint, fordi der findes client cache).

### Hvorfor det sker

`UnitedDashboard.tsx` sender `teamId` til `<ClientDashboard>`, som så sætter `scopeType = "team"` og forespørger på `kpi_leaderboard_cache` med `scope_type = 'team', scope_id = <united-team-id>`. Men de to cache-jobs (`calculate-kpi-values` og `calculate-leaderboard-incremental`) populerer kun `global` og `client` scope — **team-scope bliver aldrig beregnet**.

Resultat: alle KPI-felter beregnes som `cachedSellersToday.reduce(...)` på en tom liste = 0. Leaderboards er tomme = "Ingen salg endnu".

(Den nederste "Salg per opgave" sektion virker fordi den selv aggregerer via `kpi_cached_values` på `scope_type='client'` for hver klient i teamet — derfor kan du se klient-tal hvis du scroller, men hovedoverblikket er tomt.)

## Løsning

Da United er et **aggregat af klienter** (ikke en selvstændig sælger-pulje med egne salg), er den rene løsning at lade dashboardet **aggregere fra teamets klient-caches** i stedet for at vente på en team-cache der aldrig kommer.

### Plan

**1. Hent United-teamets klient-IDs** (eksisterende query bruges allerede i `UnitedClientBreakdown` — flyttes/genbruges).

**2. Opdater `ClientDashboard.tsx`** til at acceptere en ny config-mulighed:
```ts
features: {
  aggregateClientIds?: string[];  // hvis sat → aggreger cache fra disse klienter
}
```

**3. Når `aggregateClientIds` er sat:**
   - Hent `kpi_cached_values` for alle disse client-IDs (sales_count, total_commission, total_hours) for `today`/`this_week`/`payroll_period` → læg sammen til KPI-tallene.
   - Hent `kpi_leaderboard_cache` rows for alle disse client-IDs → flet `leaderboard_data`-arrays sammen, sumér pr. employeeId (sales + commission), sortér på commission desc → giver én samlet United-leaderboard pr. periode.

**4. `UnitedDashboard.tsx`** sender de hentede klient-IDs videre via den nye config og dropper `teamId` (eller beholder det kun som metadata).

### Hvad jeg IKKE rører
- `calculate-kpi-values` og `calculate-leaderboard-incremental` (ingen ny team-cache job — unødvendig kompleksitet)
- Andre dashboards (CPH-Sales, Eesy TM, Relatel etc. — uændrede)
- `UnitedClientBreakdown` (virker som det skal)

### Verificering efter implementering
- `/dashboards/united` → "Salg i dag", "Salg denne uge", "Salg lønperiode" viser tal > 0
- Top Løn / Top Uge / Top Dag viser sælgere fra alle United-klienter (Tryg, Finansforbundet, Codan, ALKA, AKA, A&Til, Business DK)
- Tal matcher summen af de enkelte klient-cards i "Salg per opgave"-sektionen nederst

