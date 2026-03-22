

# FM Dashboard vs Dagsrapporter: Uoverensstemmelse i salgstal

## Problem fundet

Der er **to fundamentale forskelle** i hvordan FM-salg tælles:

### 1. Salgstælling: 1 per salg vs sale_items quantity
**Dagsrapporter** (linje 885): `salesCount += 1` per FM-salgsrække — tæller rå salgsposter, ignorerer `sale_items.quantity`.

**FM Dashboard** (cached KPIs via `calculate-kpi-incremental`): Bruger `sale_items.quantity` som er standarden i hele systemet.

Hvis en FM-sale har en sale_item med quantity 2, viser FM-dashboardet 2 salg men Dagsrapporter kun 1.

### 2. Kommission/omsætning: Klient-side lookup vs sale_items
**Dagsrapporter**: Beregner FM-kommission via produktnavns-opslag i `products` + `product_pricing_rules` (klient-side). Tager IKKE hensyn til kampagne-specifikke priser.

**FM Dashboard**: Bruger `sale_items.mapped_commission` og `mapped_revenue` som er sat af database-triggeren `create_fm_sale_items` med korrekt kampagne-aware pricing.

### Løsning

Ret Dagsrapporter til at bruge `sale_items` for FM-salg — præcis som den gør for TM-salg. Dette sikrer konsistens med alle andre dele af systemet.

### Ændring i `src/pages/reports/DailyReports.tsx`

**Nuværende flow (linje 672-696, 883-908)**:
- Henter FM-salg som rå rækker fra `sales`
- Tæller `salesCount += 1` per salg
- Beregner kommission via produktnavns-lookup

**Nyt flow**:
- Hent FM-salg MED `sale_items` (ligesom TM-salg): `sale_items(quantity, mapped_commission, mapped_revenue, product_id, products(name, counts_as_sale))`
- Tæl via `sale_items.quantity` (respektér `counts_as_sale`)
- Brug `mapped_commission` og `mapped_revenue` fra sale_items
- Fjern den separate `productCommissionMap`/`productRevenueMap` logik for FM

Denne ændring bringer FM-tælling og økonomi i Dagsrapporter i overensstemmelse med FM Dashboard, KPI-cache, leaderboards og lønberegninger.

| Fil | Ændring |
|-----|---------|
| `src/pages/reports/DailyReports.tsx` | Brug `sale_items` for FM-salg i stedet for rå tælling + klient-side pricing |

