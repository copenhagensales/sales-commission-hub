# Hiper Lukning / Hiper Viderestilling — de to "altid matcher"-regler

## Kort svar

Din mistanke holder — men de to regler er ikke ens i risiko, og de bør **deaktiveres**, ikke slettes.

- **Hiper Viderestilling – default**: provision 400 kr, omsætning 0 kr = fuldstændig identisk med produktets basissats (400/0). Reglen er ren støj uden effekt.
- **Hiper Lukning – default**: provision 200 kr (= basis), men omsætning **0 kr mod basis 1.300 kr**. Det ligner en fejloprettelse og er en sovende bombe: hvis reglen nogensinde bliver aktiv i beregningen, forsvinder 1.300 kr omsætning pr. salg.

## Evidens (read-only, ingen data ændret)

- `product_pricing_rules` for Hiper:
  - `3674036f…` "Hiper Lukning - default": priority 100, `conditions = {}`, ingen kampagnebinding, 200,00 / **0,00**, effective_from 2026-07-08.
  - `e05f7680…` "Hiper Viderestilling - default": priority 100, `conditions = {}`, ingen kampagnebinding, 400,00 / 0,00, samme dato.
- Basissatser i `products`: Hiper Lukning 200 / **1.300**, Hiper Viderestilling 400 / 0. Rabattrin-produkterne har ingen regler.
- Faktiske linjer i `sale_items`: 305 Hiper Lukning-linjer (gns. omsætning 1.300) og 303 Viderestilling-linjer (gns. 0) — **alle med `matched_pricing_rule_id = NULL`**. Ingen linje har nogensinde brugt de to regler.
- Årsagen: alle 608 salg har `sales.source = 'manual_entry'`, og `supabase/functions/manual-sales/index.ts:437-438, 556-557` skriver basissatserne direkte (`products.commission_dkk` / `revenue_dkk`) uden regelopslag.
- Men `rematch-pricing-rules` bruger `matchPricingRule` (index.ts:208-275), hvor en regel uden kampagnebinding og uden betingelser matcher **universelt**. Kører en rematch over disse produkter/linjer, bliver Hiper Lukning sat til omsætning 0. Så reglen er inaktiv i praksis i dag, men aktiv i logikken.
- `pricing_rule_history` har **0 rækker** for begge regler, og FK'en er `ON DELETE CASCADE` — en `DELETE` fjerner også al fremtidig/eksisterende historik og sætter `sale_items.matched_pricing_rule_id` til NULL.

## Anbefaling

Deaktiver i stedet for at slette (princip: historik bevares, mindst risikable ændring):

1. Sæt `is_active = false` på begge regler og skriv en historik-række (`change_type = 'deactivate'`) i `pricing_rule_history`, så beslutningen kan spores.
2. Rør **ikke** eksisterende `sale_items` — ingen genberegning, ingen løn- eller provisionsændring. Nuværende beløb er allerede basissats-korrekte.
3. Efter deaktivering vil både nye manuelle salg og en eventuel rematch give samme resultat: 200/1.300 for Lukning og 400/0 for Viderestilling.

## Åbent spørgsmål inden udførelse

Hvis "Hiper Lukning" i virkeligheden **skal** have 0 kr omsætning (fx fordi Hiper afregnes anderledes), er fejlen omvendt: så er det basissatsen 1.300 der er forkert, og de 305 eksisterende linjer er bogført med for høj omsætning. Det skal bekræftes af jer, før noget ændres.

## Teknisk gennemførelse (når retningen er bekræftet)

- Én migration: `UPDATE product_pricing_rules SET is_active = false WHERE id IN ('3674036f-530a-4438-be3e-37bbd192596f','e05f7680-925b-4f71-804b-ee0020051990')` plus indsættelse i `pricing_rule_history` med de gamle værdier.
- Ingen ændringer i `sale_items`, `commission_transactions`, pricing-kode eller edge functions.
- Verifikation efter migration: begge regler inaktive, antal Hiper-linjer og deres `mapped_commission`/`mapped_revenue` uændret (305 × 1.300 og 303 × 0), samt et dry-run af `rematch-pricing-rules` på Hiper-produkterne der viser `BASE_PRODUCT_PRICE` uden beløbsændring.
