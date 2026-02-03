
# Plan: Daglig Omsætning per Opgave - Ledelsesrapport

## Oversigt
Opretter en ny side under Ledelse/Rapporter der viser daglig omsætning fordelt på opgaver (klienter). Siden vil give ledelsen et overblik over hvilke opgaver der performer bedst i en given periode.

## Placering i navigation
Siden tilføjes under **Rapporter** sektionen i sidebaren som "Omsætning per opgave" med ruten `/reports/revenue-by-client`.

## Funktionalitet

### Filtre
- **Periode**: I dag, i går, denne uge, sidste uge, denne måned, valgfri datoer
- **Klient**: Valgfri filtrering på specifik klient

### Datavisning
1. **Oversigts-kort**: Total omsætning for perioden
2. **Tabel med daglig omsætning per klient**:
   - Klient navn
   - Antal salg
   - Total omsætning
   - Gennemsnitlig omsætning per salg
3. **Søjlediagram**: Daglig omsætning per klient over tid

### Datakilder
- `sales` + `sale_items` (TM salg med omsætning)
- `fieldmarketing_sales` + `products` (FM salg med omsætning)
- Genbrug af omsætningsberegningslogik fra `DailyRevenueChart`

## Tekniske detaljer

### Nye filer

| Fil | Beskrivelse |
|-----|-------------|
| `src/pages/reports/RevenueByClient.tsx` | Hovedsiden med filtre, tabel og chart |

### Eksisterende filer der ændres

| Fil | Ændring |
|-----|---------|
| `src/routes/pages.ts` | Tilføj lazy export for `RevenueByClient` |
| `src/routes/config.tsx` | Tilføj rute `/reports/revenue-by-client` med permission |
| `src/config/permissionKeys.ts` | Tilføj `menu_reports_revenue_by_client` permission key |
| `src/components/layout/AppSidebar.tsx` | Tilføj navigation link under Rapporter |

### Permission
- Ny permission key: `menu_reports_revenue_by_client`
- Label: "Omsætning per opgave"
- Sektion: `reports`

### UI Struktur

```text
+------------------------------------------+
| Daglig omsætning per opgave              |
| Overblik over omsætning fordelt på klienter |
+------------------------------------------+
| [Periode ▼] [Klient ▼]                   |
+------------------------------------------+
| Total omsætning:  245.600 kr             |
+------------------------------------------+
|                                          |
|  [Bar chart - omsætning per dag/klient]  |
|                                          |
+------------------------------------------+
| Klient       | Salg | Omsætning | Gns.   |
|--------------|------|-----------|--------|
| Tryg         |   45 | 125.000   | 2.778  |
| Eesy         |   32 |  78.400   | 2.450  |
| ASE          |   18 |  42.200   | 2.344  |
+------------------------------------------+
```

### Omsætningsberegning
Genbrug af logik fra `DailyRevenueChart`:
1. Hent salg fra `sales` med `client_campaigns.client_id`
2. Hent `sale_items` med `mapped_revenue`
3. Anvend campaign overrides fra `product_campaign_overrides`
4. Tilføj FM salg fra `fieldmarketing_sales` med produktomsætning fra `products`
5. Aggregér per klient og dato

## Database
Ingen ændringer nødvendige - bruger eksisterende tabeller.

## Opsummering af ændringer
1. Opret ny page-komponent med filtre og data-visning
2. Registrer rute og permission
3. Tilføj sidebar-navigation
