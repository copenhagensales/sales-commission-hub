
# Slet fallback-regler oprettet 15. februar

## Overblik
Der er **44 fallback-regler** oprettet den 15. februar i to batches:

| Batch | Tidspunkt | Antal |
|-------|-----------|-------|
| Batch 1 | 15:15:18 | 39 |
| Batch 2 | 16:38:20 | 5 |
| **Total** | | **44** |

**398 salg** er aktuelt matchet til disse regler og vil blive genmatchet.

## Plan

### Trin 1: Slet de 44 fallback-regler
Slet alle prisregler med prioritet 0, ingen betingelser, oprettet den 15. februar 2026.

```text
DELETE FROM product_pricing_rules
WHERE priority = 0 
  AND (conditions IS NULL OR conditions = '{}'::jsonb)
  AND created_at::date = '2026-02-15'
```

### Trin 2: Nulstil de 398 paavirkedede salg
Saet `matched_pricing_rule_id = NULL` saa de kan genmatches:

```text
UPDATE sale_items
SET matched_pricing_rule_id = NULL
WHERE matched_pricing_rule_id NOT IN (
  SELECT id FROM product_pricing_rules
)
```

### Trin 3: Koer rematch
Kald `rematch-pricing-rules` edge-funktionen for at genmatch alle salg uden matchet regel. De faar enten en specifik prisregel eller basispriserne fra products-tabellen.

### Trin 4: Verificer
Tjek at alle 398 salg er korrekt genmatchet.

## Teknisk note
Ingen kodeaendringer -- kun 2 database-operationer (DELETE + UPDATE) og et kald til den eksisterende edge-funktion.
