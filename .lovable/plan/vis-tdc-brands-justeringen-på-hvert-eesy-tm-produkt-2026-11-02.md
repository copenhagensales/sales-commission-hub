# Vis "TDC Brands"-justeringen på hvert Eesy TM-produkt

## Hvorfor du ikke kan se den
Reglen virker (75 salg er justeret), men den ligger i dag kun under fanen **Justeringer** i Kunder og priser. Den er ikke en almindelig prisregel på produktet, fordi den lægges oven på prisen til sidst. Derfor står den ikke, når man åbner et produkts prisregler.

## Ændring (kun visning)
- I produktets prisregel-vindue tilføjes en lille boks nederst: **"Justeringer til sidst"**, der viser aktive justeringer, som rammer produktet: navn, betingelse (TDC Brands = Ja), -70 % provision og omsætning, gældende fra 29/10, og hvilken kunde (Eesy TM).
- Teksten forklarer, at justeringen gælder salg på den kunde og beregnes efter reglen ovenfor.
- 5GI MBB viser ingen boks, da den er undtaget.
- Link/henvisning til fanen Justeringer for redigering.

Ingen ændring af priser, regler, salg, provision eller database.

## Teknisk
- Genbrug `usePricingAdjustments` (ingen ny datakilde); filtrér klientside på aktiv regel, hvor produktet er omfattet (alle produkter på kunden minus undtagne ids, eller eksplicit produktliste — følger reglens felter som de læses i `pricingAdjustments.ts`).
- Kun `src/components/mg-test/ProductPricingRulesDialog.tsx` (+ evt. lille ren helper med test for "rammer produktet?").
