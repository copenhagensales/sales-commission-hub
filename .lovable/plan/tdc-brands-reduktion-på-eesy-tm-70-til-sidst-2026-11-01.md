# TDC Brands-reduktion på Eesy TM (−70 % til sidst)

## Hvad der findes i dag (bekræftet)
- Adversus-feltet »TDC Brands« (Ja/Nej) gemmes allerede på Eesy TM-salg i `leadResultData` fra 29/10 (111 salg: 46 Ja, 65 Nej). Det bruges ingen steder i Stork.
- Prisreglerne giver en fast kronesats, og hvert salg får kun den ene regel, der vinder (`product_pricing_rules`, højeste priority). Der findes ingen regel, der justerer prisen bagefter.
- Satsen beregnes to steder i backend, som skal holdes ens: `integration-engine/core/sales.ts` (nye salg) og `rematch-pricing-rules/index.ts` (genberegning). Frontend har en spejling i `src/lib/calculations/pricingRuleMatching.ts`.
- Eesy TM har 10 aktive produkter. Kun ét hedder »5GI MBB«. »Fri tale + … (5G)«-produkterne er almindelige abonnementer og rammes af reduktionen.

## Hvad der bygges
1. **Ny regeltype »Justering til sidst«** under Kunder og priser → Eesy TM:
   - Betingelse: Adversus-felt »TDC Brands« = »Ja«
   - Reduktion: 70 % af både provision og omsætning (sælgeren får 30 % af den sats, der ellers ville gælde)
   - Gælder fra: 29/10/2026, ingen slutdato
   - Produkter: alle Eesy TM-produkter undtagen 5GI MBB, også bisalg og tillægsprodukter i kurven
2. **Rækkefølge:** Justeringen er ikke en prisregel og konkurrerer ikke med dem. Først beregnes satsen præcis som i dag: alle eksisterende regler (kampagne, betingelser, datoer og priority) vælger satsen, ellers bruges grundprisen. Bagefter tages 70 % af den færdige sats. Eksempel: en regel giver 400 kr. provision / 1.000 kr. omsætning → med TDC Brands = Ja bliver det 120 kr. / 300 kr. Det gælder både ved nye salg og ved genberegning, og der rundes til hele kroner.
3. Låste linjer (manuel prislås) røres ikke.
4. Hver linje får gemt, at justeringen er brugt (regel-id), så det kan ses og spores.
5. **Engangsgenberegning** af Eesy TM-salg fra 29/10 med TDC Brands = Ja (cirka 46 salg) via den eksisterende genberegning, så de får de nye satser.

## Konsekvenser
- Provision og omsætning falder 70 % på de berørte salg i den aktuelle lønperiode (15/10–14/11). Boards, rapporter og løn viser de nye tal efter genberegningen.
- Salg med »Nej«, uden feltet eller fra før 29/10 er uændrede.
- Ingen andre kunder eller regler ændres.

## Tekniske detaljer
- Migration: ny tabel `pricing_adjustment_rules` med `client_id`, `name`, `conditions` (jsonb, samme format og `evaluateTextCondition` som prisregler), `excluded_product_ids uuid[]`, `percent_reduction numeric`, `effective_from`/`effective_to`, `is_active` og `priority` (rækkefølge, hvis der kommer flere). RLS: læse for indloggede med prisrettighed, skrive for dem, der i dag kan redigere prisregler (samme rettighedstjek som `product_pricing_rules`). Grants: `authenticated` + `service_role`. Ingen SECURITY DEFINER.
- Kolonnen `sale_items.adjustment_rule_id uuid null` gøres nullable og tilføjes (additiv).
- Én fælles funktion `applyPricingAdjustments` i `supabase/functions/_shared/pricingAdjustments.ts`, spejlet 1:1 i `src/lib/pricing/pricingAdjustments.ts`. En test sammenligner filerne og tester 70 % / undtagelsen for 5GI MBB / datogrænsen 29/10 / Nej giver ingen ændring.
- Kaldes i `integration-engine/core/sales.ts` og `rematch-pricing-rules` lige efter, at satsen er valgt. Funktionerne udrulles bagefter.
- UI: en ny sektion »Justeringer til sidst« på kundens prisside (hook med React Query; ingen direkte kald fra komponenter).
- Reglen oprettes som data efter migrationen. Derefter kører genberegningen kun for Eesy TM fra 29/10.

## Kontrol
- Tests bestod; byg uden fejl.
- Før/efter-optælling (kun antal og summer): antal berørte linjer og samlet provision/omsætning for TDC Brands = Ja fra 29/10. Summen efter skal være 30 % af summen før.
- Stikprøve på ét salg med »Nej« og på ét 5GI MBB-salg: uændret.
