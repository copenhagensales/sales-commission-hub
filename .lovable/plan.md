# Ret tilskud til 100% på Gustav Diebels salg (Sales ID 45785734)

## Hvad jeg har fundet (verificeret)

Salget er entydigt identificeret: Relatel-salg fra Gustav Diebel 14/9 kl. 11:47, Sales ID 45785734 står i dialerens leadfelter, sammen med **Tilskud: 0%**.

Salget indeholder præcis de tre linjer du nævner, med nuværende provision:

| Linje | Antal | Provision nu | Omsætning nu | Matchet regel |
|---|---|---|---|---|
| Fri Tale - 2000 GB BTL #5 | 1 | 1.530 kr | 3.225,85 kr | "Uden tilskud" (Tilskud = 0%) |
| Fri Tale - 60 GB ATL | 1 | 1.270 kr | 2.725,80 kr | "Uden tilskud" (Tilskud = 0%) |
| Omstillingsbruger #3 | 2 | 350 kr pr. stk. | 656,55 kr pr. stk. | "Uden tilskud" (Tilskud = 0%) |

Vigtigt: der findes i dag **ingen prisregel nogen steder i systemet med Tilskud = 100%**. Alle aktive regler på disse produkter er 0%-regler. Derfor kan tilskuddet ikke bare ændres — der er ingen regel at matche på.

Du bad mig tage satserne fra produkterne. Produkternes egne satser er:

| Produkt | Provision | Omsætning |
|---|---|---|
| Fri Tale - 2000 GB BTL #5 | 1.125 kr | 2.500 kr |
| Fri Tale - 60 GB ATL | 965 kr | 2.175 kr |
| Omstillingsbruger #3 | 130 kr | 261 kr |

Planen bruger disse tal som 100%-tilskudssatser. Bekræft, at det er de rigtige satser — de er lavere end 0%-satserne, hvilket passer med at tilskudssalg giver mindre provision, men det er en antagelse jeg ikke kan bekræfte i koden.

## Hvad der bliver rettet

Kun dette ene salg:

1. Tilskudsværdien på salget sættes til 100% i Stork, så rapporter og kvalitetsoverblik viser det rigtige. Den oprindelige dialerværdi (0%) gemmes med, så historikken kan spores.
2. De fire linjer får ny provision og omsætning efter produkternes satser:
   - Fri Tale 2000 GB: 1.530 → 1.125 kr
   - Fri Tale 60 GB: 1.270 → 965 kr
   - Omstillingsbruger × 2: 350 → 130 kr pr. stk.
   - Samlet provision på salget: 3.850 → 2.350 kr
3. Rettelsen logges, så det kan ses hvem der rettede hvad og hvorfor.

Ingen andre salg, sælgere, lønberegninger, pricing-regler eller annulleringer røres.

## Vigtig konsekvens du skal kende

Fordi vi ikke opretter en 100%-prisregel, er rettelsen manuel. Hvis der senere køres et fuldt prisgenmatch på Relatel-produkterne, kan salget blive matchet tilbage til 0%-satserne, og rettelsen forsvinder. Jeg lægger derfor en beskyttelse ind: salget markeres som manuelt rettet, så genmatch springer det over.

Hvis I fremover får flere tilskudssalg, anbefaler jeg som en separat opgave at oprette rigtige Tilskud = 100%-prisregler, så det sker automatisk fremover. Det ligger uden for denne opgave.

## Teknisk

- Salg: `sales.id = 06c6303c-0eb4-4196-b5cc-f17b06df43f3`, `dialer_campaign_id = 85913`, source `Relatel_CPHSALES`.
- Tilskud læses af prismotoren fra `raw_payload.leadResultFields`/`leadResultData` (se `supabase/functions/rematch-pricing-rules/index.ts:709-732`). Tilskudsrettelsen skrives derfor både i `leadResultFields`/`leadResultData` og i `normalized_data`, mens den oprindelige rå værdi bevares i et nyt felt (fx `raw_payload.manual_corrections`) — rådata overskrives ikke uden spor.
- `sale_items` for salget opdateres med `mapped_commission`/`mapped_revenue` fra `products.commission_dkk`/`revenue_dkk`, `matched_pricing_rule_id` sættes til NULL og `needs_mapping` forbliver `false`.
- Beskyttelse mod fremtidigt genmatch implementeres via et eksplicit manuel-rettelses-flag, som `rematch-pricing-rules` respekterer. Findes der ikke et sådant flag i dag, tilføjes det som en lille, additiv ændring (kolonne + skip-betingelse) uden at ændre matchlogikken for øvrige salg.
- Migration + RLS-tjek udføres, hvis flaget kræver en ny kolonne. Ingen historiske tabeller ændres.
- Efter rettelsen verificeres med SQL, at salget viser Tilskud 100% og samlet provision 2.350 kr, og at ingen andre salg er berørt.
