

## Problem

United-dashboardet viser stadig 0. Min forrige fix tilføjede `aggregateClientIds`-logik, men den nye `useAggregatedClientKpis` hook bliver **aldrig kaldt** med rigtige client IDs. Network-loggen viser kun den gamle `UnitedClientBreakdown`-query (kun `sales_count`) — ikke vores nye hook der ville hente `sales_count + total_commission + total_hours` med `.in("kpi_slug", [...])`.

### Sandsynlig årsag

`UnitedDashboard.tsx` har **to separate queries** der henter teamet og dets klienter:
1. `united-team-with-clients` → bruges af `<ClientDashboard>` via `aggregateClientIds`
2. `united-team-clients` → bruges af `<UnitedClientBreakdown>`

Den første query fyres aldrig (eller dens data når aldrig frem) — derfor er `aggregateClientIds = undefined` i `ClientDashboard`, hvilket gør `isAggregated = false`, og dashboardet falder tilbage til den tomme team-cache (`scopeType="team", scopeId=teamId`) → 0.

## Løsning

**1. Konsolidér til én query** for United team + klient-IDs, og brug samme cache-key i både `UnitedDashboard` og `UnitedClientBreakdown`. Dette eliminerer race-conditions og sikrer at `aggregateClientIds` altid er populeret når `<ClientDashboard>` renderes.

**2. Fjern `teamId`** fra `<ClientDashboard>` config når vi er i aggregeret mode, så `scopeId` ikke peger på et tomt team-cache. `isAggregated` skal være eneste signal.

**3. Tilføj defensiv logging** i `useAggregatedClientKpis` (kort stub: `console.log("[aggregated-kpis] running with N ids")`) så vi kan verificere via console at hooken faktisk fyrer efter fix.

**4. Verificér i console + network** efter genindlæsning:
   - Network: nyt request med `kpi_slug=in.(sales_count,total_commission,total_hours)` for de 8 client IDs
   - Network: `kpi_leaderboard_cache?scope_type=eq.client&scope_id=in.(...)` requests
   - Console log fra hooken
   - UI: KPI-tal > 0 og leaderboards populeret

### Hvad jeg IKKE rører
- `UnitedClientBreakdown` (virker fint, viser allerede tal)
- Cache-jobs eller team-scope cache-population
- Andre dashboards

### Filer der ændres
- `src/pages/UnitedDashboard.tsx` (konsolidér query, drop `teamId` ved aggregering)
- `src/hooks/useAggregatedClientCache.ts` (tilføj debug-log)

