

# Fix: Rematch-funktionen springer salg med eksisterende basispriser over

## Problem
Rematch-funktionen har et filter der kun processer salg med `mapped_commission = 0`. Salg der allerede fik tildelt basispriser fra produkttabellen (f.eks. 880 kr i stedet for 730 kr) blev derfor sprunget over - selv om der nu findes korrekte prisregler.

**1.962 salg** i februar 2026 er berort, med en samlet fejlagtig provision paa 924.516 kr.

For Rasmus Quiding Fricke specifikt: 7 ud af 13 salg bruger stadig forkerte basispriser i stedet for de korrekte prisregler.

## Loesning

### Trin 1: Opdater rematch-funktionen
Aendr filteret i `supabase/functions/rematch-pricing-rules/index.ts` saa den ogsaa processer salg UDEN matched pricing rule - uanset om de allerede har en commission-vaerdi:

**Nuvaerende logik (linje ~186-192):**
```
// Kun items med matched_pricing_rule_id IS NULL OG mapped_commission = 0
query = query
  .is("matched_pricing_rule_id", null)
  .not("product_id", "is", null)
  .eq("mapped_commission", 0);
```

**Ny logik:**
```
// Items uden matched rule ELLER med commission = 0
query = query
  .is("matched_pricing_rule_id", null)
  .not("product_id", "is", null);
```

Fjerner `mapped_commission = 0` filteret, saa ALLE salg uden matched rule genberegnes - ogsaa dem der allerede har (forkerte) basispriser.

### Trin 2: Koer rematch
Naar den opdaterede funktion er deployet, koeres rematch for at genberegne alle 1.962 salg med korrekte prisregler.

## Forventet resultat
- Rasmus Quildings provision aendres fra nuvaerende vaerdier til de korrekte regelbaserede priser
- Alle 1.962 berorte salg faar korrekt provision baseret paa prisregler i stedet for basispriser

## Tekniske detaljer
- Kun 1 fil aendres: `supabase/functions/rematch-pricing-rules/index.ts` (fjern `.eq("mapped_commission", 0)`)
- Derefter koeres rematch via edge function kald
- Ingen frontend-aendringer nødvendige

