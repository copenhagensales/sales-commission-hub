
## Problem identificeret

Skærmbilledet viser kun **6 Eesy TM produkter med 28 regler** — men databasen har faktisk:
- **6 "synlige" parent-produkter** (korrekt)
- **11 mergede child-produkter** der ikke vises (korrekt skjult)
- **84 aktive pricing rules** fordelt på parents (men UI viser kun 28 → der er 56 "manglende")

### Rod-årsager i `CommissionRatesTab.tsx`

**1. Aggressiv "deduplikering" skjuler legitime regler (linje 137-145)**
```ts
const isDuplicate = group.rules.some(
  (r) => r.commission_dkk === rule.commission_dkk
      && r.revenue_dkk === rule.revenue_dkk
      && r.campaignNames.join(",") === campaignNames.join(",")
);
```
DB siger 84 rules → UI viser 28. Den dropper ~56 regler fordi den anser dem som "dubletter" hvis pris+kampagne matcher — men det er forkert: to regler kan have samme tal men forskellige `priority`, `effective_from/to` datoer, conditions eller subsidy-flags. **Produktet "Fri tale + 110" har 41 aktive regler i DB men UI grupperer dem til 17.**

**2. Children-produkter respekteres ikke (linje 48-67, 107-124)**
Tabellen henter ALLE produkter (inkl. mergede children med `merged_into_product_id != null`) og grupperer dem efter `name` - men siden children typisk har varianter af parent-navnet, ender de som separate rækker. Skærmbilledet viser fx 4 separate rækker for varianter af "Fri tale + 150 GB...", "Fri tale + 30 GB..." — disse er **mergede children** der iflg. memory ([Product Composite UI](mem://features/products/composite-management-ui)) skal vises som ét sammensat produkt under deres parent.

I `MgTest.tsx` filtreres children korrekt fra med `.is("merged_into_product_id", null)` — men `CommissionRatesTab` mangler dette filter. Resultatet:
- Samme produkt kan vises 2 gange (parent + child med næsten samme navn)
- Children vises uden regler ("—") fordi rules ligger på parent
- Forvirrende rækkefølge

**3. Ingen visning af kampagne-mapping/priority-detaljer**
Når flere regler dedupes til én, mister man information om hvilke kampagner/priorities der er konfigureret.

**4. Tæller "Regler" matcher ikke virkeligheden**
Badge viser 17 regler — DB har 41. Brugeren kan ikke stole på tællingen.

### Plan: ret `CommissionRatesTab.tsx`

**A. Filtrer mergede children fra hovedlisten**
- Tilføj `.is("merged_into_product_id", null)` i product-query (samme mønster som `MgTest.tsx`).
- Eventuelt: hent children separat og vis dem som "varianter" under parent-rækken (sammensat produkt-visning, jvf. memory).

**B. Fjern den ødelæggende deduplikering**
- Vis ALLE aktive pricing rules som de er.
- Hvis to regler genuint er identiske kan vi i stedet **gruppere visuelt** efter `priority` + datoer, eller markere `(dublet?)` med advarsel - men aldrig skjule data.

**C. Vis flere rule-detaljer**
- Tilføj kolonner/badges for: `priority`, `effective_from`, `effective_to`, conditions/tilskud-flag.
- Vis rule-`name` selv når kampagner findes (så bruger ser "Tilskud" / "Subsidy" osv.).

**D. Korrekt rule-tælling**
- "Regler"-badge skal vise faktisk antal aktive rules fra DB (samme tal som tooltip i `MgTest.tsx`'s `productRuleCounts`).

**E. Inkludér rules fra mergede children på parent**
- Hvis child stadig har egne rules (sjældent men muligt), tæl dem under parent for at vise det fulde billede.

### Tekniske ændringer

- **`src/components/mg-test/CommissionRatesTab.tsx`**:
  - Product-query: tilføj filter `.is("merged_into_product_id", null)`.
  - Hent også children for visning som varianter under parent (valgfrit men anbefalet).
  - Pricing-rules query: include `effective_from`, `effective_to`, `conditions`.
  - Fjern deduplikerings-loop; render alle rules.
  - Tilføj priority/dato-info i rule-rækken.
  - Tæl alle rules (også fra child-produkter hvis de har).

### Forventet effekt
- Eesy TM viser igen alle 84 regler korrekt fordelt
- Ingen falske dubletter af produktnavne
- Mergede varianter samlet under deres parent
- Tællingen "X produkter · Y regler" matcher DB-virkeligheden
- Brugeren kan se priority, datoer og betingelser pr. regel
