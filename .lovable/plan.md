**Konklusion:** Produkterne findes i databasen, men MgTest-visningen skjuler/forvirrer dem, fordi gruppen "Manglende mapping" ikke nødvendigvis svarer til `needs_mapping=true`, og fordi listen begrænses/afhænger af en generel produkt-RPC. Jeg vil lave et lille UI/data-fix, ikke ændre pricing-logikken.

**Fund lige nu**
- Der er aktuelt **390 sale_items** de seneste 30 dage med `needs_mapping=true` og `product_id IS NULL`.
- De fordeler sig bl.a. på:
  - Tryg/ukendt kampagne: 350 items
  - Finansforbundet: 24 items
  - Eesy TM: 13 items
  - Relatel: 3 items
- Eesy TM umappede produkter findes bl.a.:
  - `Fri tale + 100 GB data (5G) (6 mdr. binding)`
  - `Fri tale + 80 GB data (5G) (6 mdr. binding)`
  - `Fri tale + 40 GB data (5G) (6 mdr. binding)`
  - `Fri tale + fri data (5G) (6 mdr. binding) 10 % Rabat`

**Zone**
- Dette rammer MgTest/datamapping UI og en eksisterende read/query-visning: **gul zone**.
- Jeg ændrer ikke pricing-motor, løn, `sale_items` historik eller provisionsberegning i dette step.

**Plan**
1. **Lav separat datakilde til manglende mappings i MgTest**
   - Brug den eksisterende `needsMappingItems` query som sand kilde for alert/dialog.
   - Udvid den med `adversus_external_id`, `sale_source`, `sales(client_campaign_id, client_campaigns(...clients...))`, så produkt, kilde og kunde kan vises.

2. **Vis en rigtig “Manglende mapping”-tabel direkte i produktfanen**
   - Øverst i produktfanen vises de umappede produkt-typer grupperet efter `adversus_external_id + adversus_product_title + kunde`.
   - Kolonner: Produktnavn, External ID, Kunde/kilde, Antal salg, seneste dato, handling.
   - Handlingen bliver den eksisterende mapping-flow: vælg kunde/produktindstillinger, opret mapping og sæt `product_id` på relevante `sale_items`.

3. **Ret cache/invalidation efter mapping**
   - Efter mapping invalidér både:
     - `mg-needs-mapping-items`
     - `mg-aggregated-products`
     - `adversus-product-mappings`
     - `products`
   - I dag invalidéres primært `mg-needs-mapping-count`, men count er afledt af `mg-needs-mapping-items`, så UI kan blive stale.

4. **Gør alerten mere brugbar**
   - Alerten skal vise faktisk antal umappede sale_items og åbne detaljer.
   - Dialogen skal vise External ID + kilde/kunde, så man kan identificere Eesy TM-produkterne hurtigt.

5. **Verificering**
   - Bekræft i databasen at de umappede Eesy TM-produkter kommer ud af queryen.
   - Bekræft at MgTest viser dem i “Manglende mapping” uden at skulle rematche eller ændre priser.
   - Ingen rematch køres automatisk i denne rettelse, medmindre du bagefter mapper produkterne og aktivt vil opdatere historiske priser.

**Teknisk note**
- Jeg vil helst holde fixet i `src/pages/MgTest.tsx` først, fordi det er der nuværende visning allerede ligger.
- Hvis det viser sig at RPC’en `get_aggregated_product_types()` også skal justeres for langsigtet korrekthed, laver jeg en separat migration-plan, fordi DB-funktioner/pricing-adjacent logik er højere risiko.