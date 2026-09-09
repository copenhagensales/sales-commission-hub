# Verifikation: påvirker en ny regel med "Type møde" kun salg fra den satte dato?

Konklusion: Ja — for en NY regel med ikrafttrædelsesdato = i dag er der nu to uafhængige spærringer, og begge er verificeret i koden. Ingen ændringer er nødvendige for dette scenarie.

## Evidens (læst i HEAD)

1. Datoafgrænsning sendes korrekt fra UI til edge function
   - `src/components/mg-test/PricingRuleEditor.tsx:445-448` — efter gem kaldes `sync({ rematch: true, productId, effectiveFromDate: format(effectiveFrom, "yyyy-MM-dd") })`
   - `src/hooks/useMgTestMutationSync.ts:141-158` — sender `effectiveFromDate` videre
   - `src/hooks/useRematchPricingRules.ts:37-47` — konverterer datoen til midnat og sender `min_sale_datetime` (den nøgle, edge functionen faktisk læser). Dette var netop gårsdagens fejl, og den er lukket.
   - `supabase/functions/rematch-pricing-rules/index.ts:496-498` — `query.gte("sales.sale_datetime", minSaleDatetime)`, så kun salg fra datoen hentes til genberegning.

2. Reglen selv kan ikke ramme ældre salg
   - `index.ts:243-249` — et salg springer reglen over hvis `saleDateStr < rule.effective_from`. Så selv hvis en rematch uden dato kørte senere, matcher gamle salg ikke den nye "Type møde"-regel.

3. Reglen gemmes med dato
   - `PricingRuleEditor.tsx:389` — `effective_from: format(effectiveFrom, "yyyy-MM-dd")`. Bekræftet i data: de fire TDC-fiberregler fra i går ligger med `effective_from = 2026-09-08`.

## Praktisk fremgangsmåde jeg anbefaler ved oprettelse

1. Opret "Type møde"-reglen som en NY regel (ikke redigering af en eksisterende sats) med ikrafttrædelsesdato = den ønskede dato.
2. Sæt `effective_to` på den gamle regel til samme dato, hvis den gamle sats skal stoppe (matcheren bruger `saleDateStr >= effective_to` som slut).
3. Kør en dry-run rematch (`dry_run: true`, `min_sale_datetime` = datoen) og kontrollér at `stats.total` kun dækker salg fra datoen — det skriver intet.

## Resterende risici (ikke en del af dit spørgsmål, men værd at kende)

- Regler UDEN `effective_from` (NULL) gælder al historik. Hvis du redigerer satsen direkte på en sådan regel, ændres historiske salg næste gang en rematch rører produktet.
- Sletning af en regel kører rematch UDEN datoafgrænsning (`ProductPricingRulesDialog.tsx:278-283`) → hele produktets historik kan blive genprissat. Undgå at slette gamle regler; sæt `effective_to` i stedet.
- Auto-rematch i `MgTest.tsx:1144` kører uden dato, men rammer kun sale items uden `matched_pricing_rule_id` (ikke-prissatte), så historik med priser berøres ikke.

Vil du have en af de to punkter ovenfor lukket i kode (fx datoafgrænsning ved regelsletning), laver jeg en separat plan for det.
