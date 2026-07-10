## Problem

Almindelige sælgere ser 0/tomme værdier i kolonnerne **Fiber salg** og **Fiber provi** på TDC Erhverv-dashboardet, mens totalprovisionen stemmer.

## Rod-årsag (evidens)

RLS på `sale_items` tillader kun sælgeren at læse egne rækker:
- `supabase/migrations/20260114135306_...sql:48` — policy `"Employees can view own sale_items"`

`src/hooks/useFiberBoardStats.ts` og `src/hooks/useFiberSalesCount.ts` læser `sale_items` direkte i auth-mode. Derfor:
- Sælger A ser kun egne fiber-tal → andre sælgere står med 0
- Totalprovisionen kommer fra cached leaderboard (SECURITY DEFINER RPC) → bypass RLS → stemmer
- TV-mode virker allerede, fordi den kalder `tv-dashboard-data` edge function (service role)

## Fix

Rut auth-mode gennem samme edge function som TV-mode i de to fiber-hooks. Hooksne bruges kun når `config.features.fiberBoard === true`, hvilket kun er sat på TDC Erhverv-dashboardet (`src/pages/TdcErhvervDashboard.tsx`). Alle TDC-sælgere ser dermed samme fiber-tal for alle sælgere på boardet — som ønsket. Ingen andre dashboards/teams eller data påvirkes. RLS ændres ikke.

## Ændringer

**1. `src/hooks/useFiberBoardStats.ts`**
- Fjern `isTvMode()`-gate. Kald altid `tv-dashboard-data?action=fiber-board-stats`.
- Fjern direkte `sale_items` + `employee_agent_mapping` + `employee_master_data`-blok.
- Forenkl `queryKey` (drop `"tv"|"auth"` variant — cachen kan deles).

**2. `src/hooks/useFiberSalesCount.ts`**
- Samme: fjern `isTvMode()`-gate, kald altid `tv-dashboard-data?action=fiber-sales-count`.

**3. Edge function `supabase/functions/tv-dashboard-data/index.ts`**
- Ingen ændring. Endpointsne findes allerede (linjer 234, 248) og bruger service role.

Ingen ændring i: `TvDashboardComponents.tsx`, `ClientDashboard.tsx`, RLS-policies, KPI-suffix-logik.

## Verificering

1. Log ind som almindelig TDC-sælger → `/dashboards/tdc-erhverv` → leaderboard viser fiber-point og fiber-provi for alle sælgere.
2. Total-provision uændret.
3. TV-board uændret.
4. Relatel/Eesy/øvrige dashboards uændrede (`fiberBoard` ikke sat).
