

## Plan: Simplificér matcher til ren exact-match + fix kø-rækker

### Trin 1: Fix `src/utils/productConditionMatcher.ts`
- **Slet** `valueMatchesAny` funktionen (linje 62-79) helt
- **Erstat** `valueMatchesAny(cellValue, vals)` med `vals.includes(cellValue)` i `evaluateConditions` (linje 101, 104)
- **Tilføj** console.log i `findMatchingProductId` til debugging

### Trin 2: Slet de 53 forkerte kø-rækker (database migration)
- Slet rækker fra `cancellation_queue` hvor `target_product_name = '5G Internet'` men uploaded_data's Subscription Name IKKE er "5G Internet" eller "Ubegrænset data"
- Flyt disse rækkers data til `unmatched_rows` i `cancellation_imports` så de kan re-matches korrekt
- Opdatér `rows_matched` tæller

### Berørte filer
- `src/utils/productConditionMatcher.ts`
- Database: `cancellation_queue` + `cancellation_imports`

