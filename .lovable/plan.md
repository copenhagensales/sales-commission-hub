

## Fix: Brugerdefineret periode henter ikke data

### Problem
`DashboardPeriodSelector` opdaterer `selectedPeriod`-state, men ingen data-hooks bruger denne state. Alle tal kommer fra hardcodede cache-perioder (`today`, `this_week`, `payroll_period`) via `useClientDashboardKpis` og `useCachedLeaderboards`. Brugerdefineret periode har derfor ingen effekt.

### Losning
Nar brugeren valger en brugerdefineret periode (eller "i gar", "sidste 7 dage" osv.), skal dashboardet falde tilbage til en live-query mod databasen i stedet for cached KPIs. Cached KPIs understotter kun faste perioder (today, this_week, this_month, payroll_period).

### Tekniske andringer

**1. Tilfoej live-query fallback i `RelatelDashboard.tsx`:**
- Importer `useSalesAggregatesExtended` og `canUseCachedKpis` 
- Naar `canUseCachedKpis(selectedPeriod.type)` er `false`, brug `useSalesAggregatesExtended` med `selectedPeriod.from` / `selectedPeriod.to` til at hente data direkte fra databasen
- Naar `canUseCachedKpis` er `true`, brug de eksisterende cached KPIs som i dag

**2. Opdater hero-kort (KPI-cards):**
- Vis data baseret pa den valgte periode i stedet for altid at vise dag/uge/lonperiode
- For standard-perioder: brug cached KPIs (hurtigt)
- For custom/yesterday/last_7_days: brug live-aggregerede data

**3. Opdater leaderboard-tabellerne:**
- For cached perioder: brug `useCachedLeaderboards` som nu
- For custom perioder: brug `useSalesAggregatesExtended` med `groupBy: ['employee']` og vis `byEmployee` data som leaderboard

**4. Vis korrekt periode-label:**
- Brug `selectedPeriod.label` i subtitle i stedet for altid at vise payroll-perioden

### Samme monster for andre dashboards
Samme problem eksisterer i `TdcErhvervDashboard.tsx`, `UnitedDashboard.tsx`, og `EesyTmDashboard.tsx`. Disse kan fixes efterfolgende med samme tilgang.

### Kompleksitet
Middel -- kraever betinget datahentning og sammenfletning af to datakilder (cached vs. live) i UI-laget.

