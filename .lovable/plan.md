

# Fix: Fortryd-knappen nulstiller ikke salgets validation_status

## Problem
Naar man fortryder en annullering/afvisning via "Fortryd 1"-knappen, opdateres kun `sale_items`-tabellen (cancelled_quantity og is_cancelled). Men salgets overordnede `validation_status` i `sales`-tabellen forbliver uaendret ("rejected" eller "cancelled"). Det betyder, at salget stadig vises som afvist i systemet -- og med det nye rejected-filter bliver det stadig fratrukket provision og salgstal.

## Loesning
Opdater `undoOneUnitMutation` i `CancellationDialog.tsx` saa den ogsaa nulstiller `sales.validation_status` naar der fortrydes enheder.

### Logik
Efter at have dekrementeret `cancelled_quantity` paa det enkelte item, tjek om der nu er **mindst en aktiv enhed** paa tvaers af alle sale_items. Hvis ja, nulstil `sales.validation_status` til `null` (eller en passende vaerdi) saa salget igen taeller med i beregninger.

## Teknisk detalje

**Fil**: `src/components/cancellations/CancellationDialog.tsx`

I `undoOneUnitMutation.mutationFn`:
1. Udfor den eksisterende `sale_items` update (dekrementerer cancelled_quantity)
2. Derefter: Hent alle sale_items for salget og tjek om der nu er mindst en enhed der ikke er fuldt annulleret
3. Hvis ja, opdater `sales.validation_status` til `null` via `supabase.from("sales").update({ validation_status: null }).eq("id", saleId)`

Dette sikrer at saa snart en bruger fortryder bare en enkelt enhed, genaktiveres salget automatisk i alle dashboards, rapporter og KPI-beregninger.

