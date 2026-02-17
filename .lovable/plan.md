

## Nyt dashboard: "Salgsoversigt alle"

### Oversigt
Opretter en forenklet kopi af CPH Sales-dashboardet der **kun** viser "Dagens salg"-sektionen -- dvs. de to KPI-kort (Salg i dag + Saelgere pa tavlen) samt salg per klient fordelt pa kort med logoer.

### Indhold pa dashboardet
- **Header** med titel "Salgsoversigt alle" og dagens dato
- **Salg per klient i dag** -- kort-grid med klient-logoer og antal salg (inkl. fieldmarketing)
- **KPI-kort**: Salg i dag (total, bekraeftet, afventer) + Saelgere pa tavlen

Ingen date range picker, ingen top sellers, ingen team performance, ingen absence data, ingen seneste salg-liste.

### Tekniske trin

**1. Ny fil: `src/pages/dashboards/SalesOverviewAll.tsx`**
- Kopierer data-fetching fra CphSalesDashboard for `todaySalesData` og `fmTodaySales`
- Beregningsfunktioner: `calculateCountedSales`, `calculateSalesByClient`, `calculateConfirmedSales`, `calculatePendingSales`, `calculateSellersOnBoard`, `getSalesByClientWithLogos`
- Henter aktive medarbejdere via `usePrecomputedKpis`
- TV-mode support via `isTvMode()` og `tv-dashboard-data` edge function
- Renderer kun: salg-per-klient grid + 2 KPI-kort
- Bruger `useRequireDashboardAccess("sales-overview-all")`

**2. Route registrering: `src/routes/pages.ts`**
- Tilfoej: `export const SalesOverviewAll = lazyPage(() => import("@/pages/dashboards/SalesOverviewAll"));`

**3. Route config: `src/routes/config.tsx`**
- Tilfoej route med path `/dashboards/sales-overview-all`, access `"protected"`

**4. Dashboard config: `src/config/dashboards.ts`**
- Tilfoej entry: slug `sales-overview-all`, navn "Salgsoversigt alle", permissionKey `menu_dashboard_sales_overview_all`

**5. TV Board support**
- Tilfoej `"sales-overview-all"` mapping i `TvBoardView.tsx` og `TvBoardDirect.tsx`

### Filer der aendres
- **Ny**: `src/pages/dashboards/SalesOverviewAll.tsx`
- **AEndret**: `src/routes/pages.ts`, `src/routes/config.tsx`, `src/config/dashboards.ts`, `src/pages/tv-board/TvBoardView.tsx`, `src/pages/tv-board/TvBoardDirect.tsx`

