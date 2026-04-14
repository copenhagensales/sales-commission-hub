

## Baggrunds-rematch + fjern 1000-rækkers begrænsning

### Problem
1. **Blokerende UI**: `PricingRuleEditor.tsx` bruger `await rematchMutation.mutateAsync()` i `onSuccess` — dialogen venter på at rematchen er færdig før den lukker.
2. **1000-rækkers grænse**: Edge function `rematch-pricing-rules` bruger Supabase's standard `query` uden `.limit()` override eller paginering, så den henter max 1000 `sale_items` (Supabase default). Produkter med >1000 sale_items får kun opdateret de første 1000.

### Løsning

#### 1. Baggrunds-rematch i PricingRuleEditor (+ ProductPricingRulesDialog)
Ændr `onSuccess` så reglen gemmes og dialogen lukker med det samme. Rematchen kører som fire-and-forget via `rematchMutation.mutate()` (ikke `mutateAsync`). En toast informerer om at salg opdateres i baggrunden.

#### 2. Pagineret fetch i edge function
Tilføj loop i `rematch-pricing-rules/index.ts` der henter sale_items i batches af 1000 (via `.range(offset, offset+999)`) indtil alle er hentet. Samme mønster som `fetchAllPaginated` i `integration-engine/utils/batch.ts`.

### Filer der ændres

| Fil | Ændring |
|-----|---------|
| `src/components/mg-test/PricingRuleEditor.tsx` | Linje 308-326: Fjern `await`, brug `mutate()` fire-and-forget, luk dialog med det samme |
| `src/components/mg-test/ProductPricingRulesDialog.tsx` | Linje 275-280: Samme ændring — fire-and-forget rematch |
| `supabase/functions/rematch-pricing-rules/index.ts` | Linje 376-430: Paginér sale_items fetch med `.range()` loop |

