## Hvorfor 360 kr?

Cassandra's 2 salg på Sindal Marked 15/5 har:
- `client_campaign_id = Eesy marked` ✓ (fra gårsdagens fix)
- `dialer_campaign_id = NULL` ✗
- `matched_pricing_rule_id = NULL` ✗

Pricing-motoren slår op via `dialer_campaign_id → adversus_campaign_mappings` for at finde "Eesy marked"-reglen. Når den er NULL, falder den tilbage til base-prisen på produktet (Eesy uden første måned (Nuuday) = 360 kr). Markedsprisen burde være **295 kr**.

Det er præcis samme rod-årsag som vi fandt i går — men disse 8 salg blev ikke fanget i sidste batch fordi de allerede stod på "Eesy marked" og derfor ikke var i søgningen efter "gade"-salg.

## Berørte salg (8 stk, 15/5)

| Sælger | Plads | Produkt | Nu | Burde være |
|---|---|---|---|---|
| Cassandra Filippa Graves (×2) | Sindal | Nuuday | 360 kr | 295 kr |
| Noa Tejdell Raba (×2) | Lillebælt 1 | IKKE Nuuday | 450 kr | 385 kr |
| Martina Cubranovic (×1) | Lillebælt 1 | IKKE Nuuday | 450 kr | 385 kr |
| Jonathan Goldschmidt (×3) | Lillebælt 2 | IKKE Nuuday | 450 kr | 385 kr |

**Forventet effekt:** 2×(−65) + 6×(−65) = **−520 kr provision**

## Plan

1. **UPDATE** `sales.dialer_campaign_id = 'manual-1766081582109'` for de 8 sale-IDs (filter: source=fieldmarketing, sale_datetime::date=2026-05-15, client_campaign_id=Eesy marked, matched_pricing_rule_id IS NULL via sale_items).
2. **Kald** `rematch-pricing-rules` edge function for produkterne `a638c296…` (Nuuday) og `4ee2c0c6…` (IKKE Nuuday).
3. **Verificér** at alle 8 sale_items har `matched_pricing_rule_id` sat og `mapped_commission = 295/385`.

**Zone:** Rød (pricing-data). Samme bug-mønster som de foregående fixes.

Sig "kør" for at eksekvere.