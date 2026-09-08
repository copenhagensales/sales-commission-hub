# Prisændringer på TDC fiber slog tilbage i tiden — årsag og rettelse

## Hvad der faktisk skete (bekræftet)

Du ændrede i morges kl. 09:27–09:28 (dansk tid) priserne på fire produkter og valgte "Gælder fra en bestemt dato" med d.d.:

| Produkt | Provision | Omsætning | Gælder fra | Retroaktiv? |
|---|---|---|---|---|
| Lead Provi HAP | 375 | 1.000 | 08-09-2026 | nej |
| Lead Provi VOK | 625 | 1.650 | 08-09-2026 | nej |
| Lukket salg HAP | 375 | 500 | 08-09-2026 | nej |
| Lukket salg VOK | 625 | 850 | 08-09-2026 | nej |

Dine valg blev gemt korrekt: `product_price_history` har `effective_from = 2026-09-08` og `is_retroactive = false` på alle fire.

Alligevel står **alle** salgslinjer på de fire produkter helt tilbage til 10. juli nu med de nye satser (375/625 pr. styk, resten er blot antal × sats). Ingen linjer har gamle satser.

## Årsagen

Prisdialogen sender feltet `effective_from_date` til baggrundsjobbet `rematch-pricing-rules`
(`src/hooks/useRematchPricingRules.ts:40`), men funktionen læser feltet
`min_sale_datetime` (`supabase/functions/rematch-pricing-rules/index.ts:366`).

Navnene matcher ikke, så datoafgrænsningen bliver `undefined`, og filteret på linje 498
springes over. Jobbet henter derfor **alle** salgslinjer på produktet og skriver den nye
basispris ind på dem — også salg fra juli og august.

Sekundær årsag: basispris-fallbacken kender ikke prishistorik. Når en linje ikke rammer en
prisregel, bruger den `products.commission_dkk`/`revenue_dkk`, som altid er den nuværende pris.
Der findes prisregler med `effective_from`/`effective_to` (de respekteres korrekt), men de fire
fiber-produkter har ingen regler — kun basispris. Derfor kan en datoopdelt basisprisændring
ikke i sig selv holde historikken adskilt.

## Rettelse

**1. Luk hullet (kodefejl)**
Ret `useRematchPricingRules` til at sende `min_sale_datetime` (ISO-tidspunkt fra midnat på den
valgte dato), så baggrundsjobbet kun rører salg fra og med den dato. Ingen ændring i satser,
regler eller løn — kun afgrænsningen virker som den skal.

**2. Gør datoopdelte basispriser holdbare**
Så snart en dato vælges, skal den nye pris ligge som en prisregel med `effective_from`, i stedet
for kun som ny basispris på produktet. Konkret: ved "Gælder fra en bestemt dato" oprettes en
prisregel på produktet med de nye beløb og den valgte `effective_from` (uden kampagne- eller
feltbetingelser, så den gælder bredt), og produktets basispris efterlades urørt. Så beholder
gamle salg basisprisen, og nye salg rammer reglen. Prishistorikken skrives som i dag.
Adfærden for "Overskriv al historik" ændres ikke.

**3. Genopret de historiske satser**
De gamle satser findes ikke gemt nogen steder — `product_price_history` har kun de fire rækker
fra i dag, så systemet kan ikke selv finde tilbage. Jeg skal have de fire tidligere
provisions- og omsætningsbeløb fra dig. Derefter:

- opret pr. produkt en prisregel med de **gamle** beløb, gyldig indtil 08-09-2026, og en regel
  med de **nye** beløb fra 08-09-2026;
- kør en målrettet rematch på præcis de fire produkter, så juli/august-linjerne får de gamle
  satser tilbage og september-linjerne beholder de nye;
- kontrollér totaler før/efter på de 57 berørte salgslinjer og bekræft, at kun disse fire
  produkter er ændret.

Punkt 3 rører provisionsgrundlag (rød zone) og udføres først efter du har bekræftet de gamle
beløb og selve tilbagerulningen.

## Teknisk afgrænsning

- Ændrede filer: `src/hooks/useRematchPricingRules.ts` og
  `src/components/mg-test/ProductPriceEditDialog.tsx`.
- Ingen ændringer i `pricingRuleMatching.ts`, `_shared/pricing-service.ts`, RLS, skema eller
  lønberegning. Datofiltrering i `matchPricingRule` er allerede korrekt og røres ikke.
- Berørte salgslinjer: 26 (Lead Provi HAP), 23 (Lukket salg HAP), 4 (Lead Provi VOK),
  4 (Lukket salg VOK) — i alt 57, tidligste salg 10-07-2026.
