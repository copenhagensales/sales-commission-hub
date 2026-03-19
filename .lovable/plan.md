

# Nyt Relatel Produkt-Dashboard

## Hvad
Et nyt dashboard "Relatel Produkter" der viser 3 KPI-kort med antal oprettede produkter i en valgt periode:
- **Mobile Voice oprettet** — produkter med "Fri Tale" i navnet
- **Mobilt Bredbånd oprettet** — produkter med "MBB" eller "Mobilt Bredbånd" i navnet
- **Switch oprettet** — produkter med "Switch" i navnet

Samme periodevalg som det eksisterende Relatel-board (dag/uge/måned/lønperiode/custom). Ingen leaderboard, ingen per-medarbejder data.

## Produkt-kategorisering (baseret på faktiske data)
Relatel-produkter i databasen matcher disse mønstre:
- "Fri Tale" → Mobile Voice (ca. 20+ varianter)
- "MBB" / "Mobilt Bredbånd" → Mobilt Bredbånd (ca. 10+ varianter)
- "Switch" / "Omstillingsbruger" / "Professional" / "Contact Center" → Switch (ca. 10+ varianter)

## Nye filer
1. **`src/pages/RelatelProductsDashboard.tsx`** — simpel page-komponent der renderer det nye dashboard
2. **`src/components/dashboard/RelatelProductsBoard.tsx`** — selve dashboardet:
   - Bruger `DashboardShell`, `DashboardHeader`, `DashboardPeriodSelector`
   - Henter `sale_items` via Supabase join med `sales` + `products`, filtreret på Relatel client_id og periode
   - Kategoriserer produkter via produkt-navn matching (ILIKE patterns)
   - Viser 3 `TvKpiCard` med antal for hver kategori
   - Understøtter TV-mode

## Ændringer i eksisterende filer
3. **`src/routes/pages.ts`** — tilføj lazy import af `RelatelProductsDashboard`
4. **`src/routes/config.tsx`** — tilføj route `/dashboards/relatel-products`
5. **`src/config/dashboards.ts`** — tilføj entry med `permissionKey: "menu_dashboard_relatel"`

## Teknisk tilgang
- En `useQuery` der henter produkt-counts direkte:
```sql
SELECT p.name, SUM(si.quantity) as total_quantity
FROM sale_items si
JOIN sales s ON si.sale_id = s.id
JOIN products p ON si.product_id = p.id
WHERE s.client_campaign_id IN (
  SELECT id FROM client_campaigns 
  WHERE client_id = 'relatel-id'
)
AND s.sale_datetime BETWEEN :start AND :end
AND s.validation_status != 'Rejected'
GROUP BY p.name
```
- Client-side kategorisering af produkt-navne til de 3 grupper
- Samme periodevalg-komponent som eksisterende dashboards

