# Prisregler: tekstbetingelser med "=", "en af" og "ikke lig med"

## Formål
I en prisregel skal en tekstbetingelse (f.eks. "A-kasse type") have tre valgmuligheder:
- **=** (én værdi, som i dag)
- **en af de valgte** (flere værdier, matcher hvis salgets værdi er én af dem)
- **ikke lig med** (én eller flere værdier, matcher hvis salgets værdi IKKE er nogen af dem; et salg uden feltet matcher ikke)

## Zone
Rød zone, fordi det ændrer prisberegningen og dermed provisionen. Kræver godkendelse af denne plan.

## Sådan virker det i dag (evidens)
- Tekstbetingelser gemmes som `"Felt": "Værdi"` og sammenlignes med præcis lighed:
  - `supabase/functions/rematch-pricing-rules/index.ts:313`
  - `supabase/functions/integration-engine/core/sales.ts:205` (nye salg)
- Talbetingelser har allerede operatorer (`gte`, `in` …) i et objekt `{operator, value}`.
- Redigering: `src/components/mg-test/PricingRuleEditor.tsx` (ca. linje 787-805).

## Ændring
1. **Nyt gemt format, kun for nye/ændrede regler:** `{ "operator": "eq" | "in" | "not_in", "values": ["…"] }`. Gamle regler (`"Felt": "Værdi"`) beholdes uændret og beregnes præcis som i dag. Ingen eksisterende regler omskrives.
2. **Fælles matcher:** én lille funktion til tekstbetingelser, ført 1:1 ind begge steder (nye salg og genberegning), så de ikke kan glide fra hinanden. Talbetingelser og "medfølgende produkt" røres ikke.
3. **Editor:** dropdown med "=", "en af de valgte", "ikke lig med"; ved de to sidste vælges flere værdier fra de eksisterende muligheder. Visning af reglen i listen opdateres ("A-kasse type er en af: …").
4. **Ingen datamigration og ingen tabeländring** (betingelser ligger allerede som JSON).

## Kontrol
- Tests for matcheren: =, en af, ikke lig med, manglende felt, gammelt format.
- Prøvekørsel uden at gemme (`dry_run`) af genberegningen for berørte produkter før og efter: 0 forskelle på eksisterende salg.
- Udrul begge beregningsfunktioner samtidig.

## Uden for scope
Ingen ændring af satser, prioriteter, eksisterende regler eller løn-/provisionssider.
