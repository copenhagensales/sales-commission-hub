

## Plan: Fix updateGroup-bug og gendan 21 manglende sale_items

### Trin 1: Fix updateGroup-mutationen i EditSalesRegistrations.tsx

Ændre logikken så `sale_items` kun slettes og rematches for salg hvor kernedata (produkt, kunde, lokation) faktisk er ændret. Metadata-ændringer (kommentar, telefon) skal ikke trigge sletning.

**Fil:** `src/pages/vagt-flow/EditSalesRegistrations.tsx`

Nuværende flow:
```
for each sale in group:
  1. Update raw_payload
  2. DELETE all sale_items for this sale
  3. Call rematch-pricing-rules
```

Ny flow:
```
for each sale in group:
  1. Compare with original — has product/client/location changed?
  2. Update raw_payload
  3. ONLY IF core data changed:
     - Delete sale_items
     - Collect sale_id for batch rematch
  4. After loop: single rematch call with all changed sale_ids
```

### Trin 2: Gendan de 21 manglende sale_items

Kør `rematch-pricing-rules` edge-funktionen med alle 21 sale_ids. Funktionen vil genskabe sale_items baseret på `raw_payload.fm_product_name` og anvende korrekte priser.

### Ingen database-ændringer
Kun kodeændring i én fil + et rematch-kald for de 21 salg.

