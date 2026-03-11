

## Problem

Provision og omsætning vises forkert i EditSalesRegistrations (og potentielt andre steder) på grund af to separate fejl:

### Fejl 1: Display bruger base-priser (linje 593-618)
`productPriceMap` slår op i `products`-tabellen og får altid "gade"-priserne (fx 360 kr). De korrekte, kampagne-specifikke priser (fx 295 kr for "marked") ligger allerede i `sale_items.mapped_commission` og `sale_items.mapped_revenue`.

### Fejl 2: Mutations bruger `buildFmPricingMap()` som ignorerer kampagne-regler
`buildFmPricingMap()` i `fmPricing.ts` (linje 46-48) springer bevidst kampagne-specifikke pricing rules over. Når en sælger redigerer et salg eller opretter nye, overskrives de korrekte priser med "gade"-taksten. Samme problem findes i `useFieldmarketingSales.ts`.

**Bemærk**: Database-triggeren `create_fm_sale_items` håndterer allerede kampagne-aware prissætning korrekt ved INSERT. Frontend-koden overskriver triggerens korrekte værdier.

## Berørte filer

| Fil | Problem |
|-----|---------|
| `src/pages/vagt-flow/EditSalesRegistrations.tsx` | Display (linje 593-618) + mutations (linje 267-298, 386-411, 451-466) |
| `src/hooks/useFieldmarketingSales.ts` | Mutations (linje 256-278) |
| `src/lib/calculations/fmPricing.ts` | Kun universal rules, ignorerer kampagne-specifikke |

## Løsning

### 1. EditSalesRegistrations — Display fix
- Hent `sale_items` (sale_id, mapped_commission, mapped_revenue) for alle viste salg
- Byg `saleItemsMap: Map<sale_id, {commission, revenue}>` 
- Erstat `productPriceMap`-logikken med direkte opslag i `saleItemsMap`

### 2. EditSalesRegistrations — Mutations fix
- **Edit-mutation** (linje 267-298): Ved produktændring, lad triggeren håndtere prissætning. Alternativt: fjern den manuelle sale_items-opdatering og kald `rematch-pricing-rules` for det specifikke sale_id.
- **Batch-mutation** (linje 386-466): Fjern manuel sale_items-oprettelse for nye salg — triggeren `create_fm_sale_items` opretter dem allerede korrekt med kampagne-aware priser. For eksisterende salg: hent og brug `sale_items.mapped_commission/mapped_revenue` direkte.

### 3. useFieldmarketingSales.ts — Mutations fix  
- Fjern manuel sale_items-oprettelse (linje 256-278) da triggeren allerede håndterer dette korrekt.

### 4. Ingen ændring i fmPricing.ts
- Filen bruges stadig som fallback i andre kontekster. Problemet er at den bruges forkert i mutations.

### Resultat
- Display viser de faktiske kampagne-specifikke priser fra databasen
- Nye/redigerede salg får korrekt pris via database-triggeren
- Ingen overskrivning af triggerens korrekte prissætning

