## Problem

Konrad Dønning (15/5–14/6 2026):
- TV-dashboard: **43.655 kr** ✓ (= `SUM(sale_items.mapped_commission)`)
- Dagsrapport: **46.320 kr** ✗ (+2.665 kr fejl)

41 Eesy marked-salg × 65 kr (diff mellem gaden-pris og marked-pris) = **2.665 kr eksakt**. Samme strukturelle bug rammer Melissa, Fanny m.fl.

## Rod-årsag (evidens)

`src/pages/reports/DailyReports.tsx`:

- **L944–968 — regulære salg:** læser `item.mapped_commission` direkte fra `sale_items` ✓ kampagne-korrekt.
- **L758–769 — FM-fetch:** henter FM-salg fra `sales`-tabellen UDEN `sale_items`-join.
- **L786–817 — `productCommissionMap`:** bygges på produkt-navn (lowercased) og vælger MAX commission på tværs af alle prisregler for samme product_id (L797). Ingen kampagne-hensyn.
- **L971–996 — FM-salg-aggregering:** bruger `productCommissionMap.get(productName)` → vælger altid gaden-prisen (højest) for ALLE FM-salg, også marked-salg.

**Verifikation i DB:** Konrads 116 FM-salg har 116 `sale_items` med `SUM(mapped_commission) = 43.655` — præcis det dashboard viser. Sale_items er allerede kampagne-korrekt prisede af `enrich_fm_sale` / pricing-motoren.

To sandheder for samme tal → bryder princip 3 (én sandhed) og princip 8 (single source of truth i koden). Rød zone (rapportering af løn-relevante tal — dagsrapport bruges som sælger-overblik op til lønning).

## Fix

Én ændring i `src/pages/reports/DailyReports.tsx`:

1. **L759–769:** Udvid FM-fetch select-clause til at inkludere `sale_items(quantity, mapped_commission, mapped_revenue, product_id, products(name, counts_as_sale))` — præcis samme join som regulære salg (L650).
2. **L971–996:** Erstat `productCommissionMap`/`productRevenueMap`-lookup med iteration over `sale.sale_items` der summerer `Number(item.mapped_commission)` og `Number(item.mapped_revenue)` (kopi af mønstret L944–967).
3. **Salg-count:** behold `salesCount += 1` pr. FM-sale (FM tæller én pr. registrering), men brug `item.products.counts_as_sale` hvis vi vil være konsistent med TM. Bekræft inden.
4. **Oprydning:** Fjern `productCommissionMap`/`productRevenueMap` + `overrideByProductId` + `allProducts`-fetchen (L786–817) hvis intet andet bruger dem. (Tjek først med rg.)

## Out of scope

- Fanny's 4 ekstra salg (143 vs 139) — separat issue (FM dual-path attribution, kendt fra memory).
- TV-dashboardets cache for Melissa i `payroll_period` — separat issue.
- Ændringer i pricing-regler eller `sale_items`-data (de er korrekte).
- Anden brug af `productCommissionMap` — verificeres før sletning.

## Risiko

Lav. Vi skifter dagsrapportens FM-tal fra forkert kilde (produkt-navn MAX) til allerede-verificeret kilde (`sale_items.mapped_commission`). Efter fix vil dashboard og dagsrapport vise samme provision for FM-salg. Ingen DB-ændringer, ingen edge functions, ingen pricing-regler rørt.

## Verifikation efter fix

- Konrad 15/5–14/6: dagsrapport skal vise 43.655 kr (= dashboard).
- Melissa: 107.405 kr.
- Fanny: 51.805 kr (men 143 salg pga. dual-path — separat issue).
- TM-medarbejdere uændret (rører ikke L944–968).

## Spørgsmål før implementation

1. Skal `salesCount` for FM bevares som "+1 pr. sale" eller skiftes til `quantity` × `counts_as_sale` (matcher TM)?
2. Må jeg slette `productCommissionMap`/`productRevenueMap`/`allProducts`-fetchen hvis ingen andre bruger dem, eller skal de blive stående som dead code til senere oprydning?
