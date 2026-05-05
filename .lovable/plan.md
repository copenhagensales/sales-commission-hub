**Konklusion:** Data er der. Problemet er nu primært UI: Produktfanen viser kun **3 rækker pr. gruppe** som default, og Eesy-produkterne bliver lagt under kundegruppen **Eesy TM** – ikke i den øverste gruppe “Manglende mapping”. Derfor ser det ud som om alle produkter ikke er under mapping, selvom dialogen viser dem.

**Fund lige nu**
- Databasen har **394 sale_items** med `needs_mapping=true` og `product_id IS NULL` de seneste 30 dage.
- Det er **11 distinkte produkt/kunde-grupper**.
- Eesy TM har aktuelt disse umappede grupper:
  - `9457` — Fri tale + 40 GB data (5G) — 2 salg
  - `9458` — Fri tale + 80 GB data (5G) — 4 salg
  - `9459` — Fri tale + 100 GB data (5G) — 8 salg
  - `Fri tale + fri data ... 10 % Rabat` — 1 salg
- Screenshotet viser den rå detalje-dialog, men ikke en samlet mapping-arbejdsvisning. Den er svær at bruge, fordi den viser enkeltsalg og er begrænset i højden.

**Zone**
- Dette er **gul zone**: MgTest UI/data-flow.
- Jeg ændrer ikke pricing-motor, lønberegning, `sale_items` historik eller provisionssatser i dette fix.

**Plan**
1. **Lav en dedikeret “Produkter der mangler mapping”-sektion øverst i Produktmapping-fanen**
   - Vises altid over kundegrupperne, når der findes umappede produkter.
   - Bruger `unmappedProductGroups` direkte som kilde, ikke den almindelige produktgruppering.
   - Viser én række pr. produkt/kunde-gruppe, ikke én række pr. sale_item.

2. **Vis alle umappede produktgrupper som default**
   - Den nye sektion skal ikke være begrænset til `ITEMS_PER_SECTION = 3`.
   - Kolonner: Produktnavn, External ID, Kunde, Kilde, Antal salg, Seneste dato, Handling.
   - Eesy TM-produkterne skal derfor kunne ses samlet uden at trykke “vis flere” i en kundegruppe.

3. **Flyt/justér pseudo-rækker så “Manglende mapping” betyder reelt `needs_mapping=true`**
   - I stedet for at gemme Eesy TM umappede produkter under Eesy TM-kortet, skal den dedikerede mapping-sektion vise alle umappede produktgrupper uanset kunde.
   - De normale kundegrupper kan stadig vise eksisterende/mappede produkter, men de skal ikke være eneste sted at finde umappede produkter.

4. **Gør detalje-dialogen mere brugbar**
   - Behold dialogen til rå enkeltsalg.
   - Tilføj en lille opsummering øverst: antal salg + antal produktgrupper.
   - Eventuelt gruppér dialogen eller tydeliggør at den viser enkeltsalg, ikke produktgrupper.

5. **Ret mapping-handlinger fra den nye sektion**
   - Handlingerne genbruger eksisterende flow:
     - Vælg kunde/opret produkt
     - Opret og åbn pricing
     - Opret og skjul produkt
   - Efter handling invalidéres fortsat `mg-needs-mapping-items`, `mg-aggregated-products`, `adversus-product-mappings`, `products`.

6. **Verificering**
   - Tjek at den nye sektion viser 11 produkt/kunde-grupper.
   - Tjek at Eesy TM viser de 4 relevante grupper (`9457`, `9458`, `9459`, rabat-produktet).
   - Tjek at mapping af én gruppe fjerner den fra listen efter cache refresh.

**Teknisk note**
- Fix holdes i `src/pages/MgTest.tsx` først, fordi det er dér den nuværende Produktmapping-visning ligger.
- Jeg vil ikke splitte MgTest op i denne omgang, selvom filen er stor, for at holde ændringen lille og målrettet.