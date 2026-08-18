# Rettelsen på 41569852 gik igennem — men provisionen forsvandt

## Hvad databasen viser

- Salget (14. aug 13:40, sælger 3bddc623) står nu som **"Eesy med første måned (IKKE Nuuday)"**, sidst rettet i dag 12:49. Produktnavnet er altså rettet som ønsket.
- Men salget har **ingen linjer i `sale_items`** — dvs. 0 kr provision og 0 kr omsætning på salget lige nu.
- Samme gælder salget på **22533020** (rettet i dag 12:48, samme produkt/sælger). Derudover ligger to ældre FM-salg uden linjer: `b3bc0455` (6. aug) og `752e0042` (15. juni, 5G Internet).

## Årsag (bekræftet i koden)

`useUpdateEesyFmClaimSale` i `src/hooks/useEesyFmClaimSales.ts:242-247`: ved produktskift slettes alle `sale_items` for salget, og derefter kaldes `rematch-pricing-rules`. Rematch opdaterer priser på **eksisterende** linjer — den opretter ikke nye FM-linjer (det gør DB-funktionen `create_fm_sale_items` / `heal_fm_missing_sale_items`). Resultat: linjen forsvinder permanent.

## Forslag til handling

1. **Genskab linjerne på de berørte salg** — kør `heal_fm_missing_sale_items` (eller tilsvarende) for de 4 salg uden linjer, og verificér bagefter at provision/omsætning matcher den gældende regel for "Eesy med første måned (IKKE Nuuday)".
2. **Ret årsagen i redigeringsflowet** — ved produktskift skal linjerne genskabes i stedet for blot at slettes: kald healing-funktionen efter sletningen (og først derefter rematch), så et produktskift altid ender med korrekte linjer.
3. Verificér at samme mønster ikke bruges andre steder (fx TDC Erhverv-ret-salg), og ret det samme sted hvis det gør.

## Zone

Rød zone: pricing/løn (`sale_items.mapped_commission`, `_shared/pricing-service.ts`-kæden). Ingen skemaændring nødvendig — kun healing af data og et ekstra kald i redigeringsflowet. Kræver din godkendelse før udførelse.
