
## Mål

På TDC Erhverv – Overblik-boardet (dag/uge/lønperiode) tilføjes to nye kolonner pr. sælger:

```
# | Navn | Fiber point | Fiber provi | Salg | Provision
```

- **Fiber point** = sum af `board_points × quantity` for de 6 fiber-produkter i perioden
- **Fiber provi** = sum af `mapped_commission` for de samme salg
- **Salg** = uændret (fiber tæller ikke som salg — `counts_as_sale = false` på alle 6 produkter, så feltet forbliver "almindelige salg" automatisk)
- **Provision** = uændret (fiber-provision er allerede inkluderet i sælgerens samlede commission via `sale_items.mapped_commission`)

Kun synlig på TDC Erhverv-boardet. Andre boards er urørte.

## Point-værdier (hardkodet i config)

```ts
// src/config/fiberBoardPoints.ts
export const FIBER_BOARD_POINTS: Record<string, number> = {
  'ed0ea287-4e34-417a-98fc-de4e9aecc3bc': 0.5, // Lukket salg HAP
  'c63708fc-2f10-42a8-82dc-2728979908d9': 1.0, // Fuldt salg HAP
  'e63c9da4-3862-49e6-97df-ce5ca9ecc2e6': 0.5, // Lead Provi HAP
  '34518fa2-0d01-41f5-9cf4-be8aeda803ff': 0.5, // Lukket salg VOK
  '25e393c0-95ea-4508-925e-0449c79cb023': 1.0, // Fuldt salg VOK
  'bd6ae50b-1516-4692-be9e-09b2317bf612': 0.5, // Lead Provi VOK
};
```

Ny fiber-produkt eller ændret sats = én linje i denne fil.

## Datahentning

Ny hook `useFiberBoardStats(periodStart, periodEnd)`:

```sql
SELECT s.employee_id, si.product_id,
       SUM(si.quantity) AS qty,
       SUM(si.mapped_commission) AS commission
FROM sale_items si
JOIN sales s ON s.id = si.sale_id
WHERE si.product_id = ANY($FIBER_IDS)
  AND s.sale_datetime >= $start AND s.sale_datetime < $end
  AND (si.is_cancelled IS NOT TRUE)
GROUP BY s.employee_id, si.product_id
```

Frontend beregner point ved at gange qty med `FIBER_BOARD_POINTS[product_id]` og aggregerer pr. `employee_id`. Én query pr. periode (dag/uge/lønperiode), React Query, 60s stale.

## UI-ændringer

1. `LeaderboardSeller` udvides med `fiberPoints?: number` og `fiberCommission?: number`.
2. `TvLeaderboardTable` får ny prop `showFiber?: boolean`. Når true, rendres to ekstra kolonner mellem Navn og Salg: "Fiber point" (tabular-nums, 1 decimal hvis ikke heltal) og "Fiber provi" (formatCurrency).
3. `ClientDashboard` får ny feature-flag `features.fiberBoard?: boolean`. Kun sat på `TdcErhvervDashboard.tsx`.
4. Når `fiberBoard` er true: hent fiber-stats for de tre perioder, merge ind i `sortedPayrollSellers` / `sortedWeeklySellers` / `sortedDailySellers` via `employee_id`, og videresend `showFiber` til de tre `TvLeaderboardTable`.

## Filer der ændres

- `src/config/fiberBoardPoints.ts` (ny)
- `src/hooks/useFiberBoardStats.ts` (ny)
- `src/components/dashboard/TvDashboardComponents.tsx` (ny prop + 2 kolonner)
- `src/components/dashboard/ClientDashboard.tsx` (fiberBoard flag + merge + pass-through)
- `src/pages/TdcErhvervDashboard.tsx` (sæt `fiberBoard: true`)

## Zone

Gul zone (dashboards/præsentation). Ingen DB-ændringer, ingen lønberegning, ingen pricing-motor. `sale_items.mapped_commission` læses read-only.

## Åbne spørgsmål

Ingen — point-satser og placering er specificeret. Farvekode/decimal-format på Fiber point-kolonnen følger eksisterende TV-styling (samme font-size som Salg-kolonnen).
