

## Årsag til difference på Noa R. (99 vs 98)

De to boards bruger **forskellige tællemetoder**:

### CS Top 20 (99 salg)
Bruger `kpi_leaderboard_cache`, som beregnes af `calculate-leaderboard-incremental`. Denne tæller **sale_items quantities** — dvs. hvis ét salg har en sale_item med `quantity = 2`, tæller det som 2 salg:
```
saleSales += item.quantity || 1;  // Tæller pr. item quantity
```

### Fieldmarketing Dashboard (98 salg)  
Tæller **rå sales-rækker** fra databasen. Hver unik salgsrække = 1, uanset antal items eller quantities:
```
sellerStats[sellerId].count += 1;  // Tæller pr. salgsrække
```

### Konklusion
Noa har sandsynligvis mindst ét salg hvor `sale_items.quantity > 1` (f.eks. 2 enheder på én transaktion), eller ét salg med flere sale_items. CS Top 20 tæller alle enheder, FM-dashboardet tæller kun transaktioner.

### Anbefalet fix
Opdater Fieldmarketing Dashboardet til at tælle `sale_items` quantities i stedet for rå salgsrækker, så begge boards er konsistente. Ændringen er i `FieldmarketingDashboard.tsx`:

1. **Månedlige sælgere** (linje ~108-156): Fetch `sale_items` med quantity for hver sale, og summer quantities i stedet for `count += 1`.
2. **Daglige sælgere** (linje ~161-210): Samme ændring.

Alternativt kan man vælge at lade FM-dashboardet bruge den cached leaderboard data (som CS Top 20 gør), men det ville begrænse fleksibiliteten med klient-filtrering.

