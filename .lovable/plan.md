

## Komplet plan: Fix merge-logik + konsolider duplikerede produkter

### Problem
1. Merge-wizarden mangler opdatering af `cancellation_product_conditions` og `product_price_history` — data forbliver på deaktiverede produkter
2. Merge-historik logges med hardcoded `0`-værdier
3. To identiske "Fri tale + 150 GB data (5G) (6 mdr. binding)" produkter (`95cf33d1` og `d1bc3454`) er begge aktive og skal konsolideres

---

### Trin 1: Opdater `src/components/mg-test/ProductMergeDialog.tsx`

Tilføj i `handleMerge()` efter de eksisterende moves:

- **`cancellation_product_conditions`**: Flyt alle rækker fra kildeprodukter til target
- **`product_price_history`**: Flyt alle rækker fra kildeprodukter til target
- **Ret merge-historik**: Beregn faktiske counts for `adversus_mappings_moved`, `sale_items_moved`, `pricing_rules_moved` i stedet for hardcoded `0`

### Trin 2: Data-fix for duplikerede produkter

Via database insert-tool, konsolider `95cf33d1` → `d1bc3454`:

1. Flyt `adversus_product_mappings`
2. Flyt `sale_items`
3. Flyt `cancellation_product_mappings`
4. Flyt `cancellation_product_conditions`
5. Flyt `product_price_history`
6. Slet `product_pricing_rules` fra kilde (behold targets 275/750 regler)
7. Slet `product_campaign_overrides` fra kilde
8. Deaktiver kilde: `merged_into_product_id = d1bc3454`, `is_active = false`

### Trin 3: Kør rematch-pricing-rules

Invoke edge function for `d1bc3454` for at genberegne provision/omsætning på alle berørte sale_items.

---

### Filer der ændres
- `src/components/mg-test/ProductMergeDialog.tsx` — tilføj 2 manglende tabeller + ret historik-logging
- Database — data-fix via insert tool for de to duplikerede produkter

