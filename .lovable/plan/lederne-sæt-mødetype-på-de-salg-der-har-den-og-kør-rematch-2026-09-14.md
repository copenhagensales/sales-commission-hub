# Lederne: sæt mødetype på de salg der har den, og kør rematch

## Hvad arket viser

Arket har 221 rækker med kolonnen `Mødetype`:

- 84 rækker: Onlinemøde
- 4 rækker: Telefonmøde
- 133 rækker: ingen mødetype (tom)

Alle 88 rækker med en mødetype er verificeret til at findes som allerede oprettede Lederne-salg i Stork (matchet 1:1 på Emne-ID). Ingen af de 266 Lederne-salg siden 7. september har mødetype gemt i dag, og ingen af linjerne er manuelt låst.

## Hvad der bliver gjort

1. **Mødetypen skrives på de 88 salg** der har en i arket. Matchning sker udelukkende på Emne-ID mod det Emne-ID, der allerede står på salget. Kun mødetype-feltet tilføjes — dato, sælger, telefon, kampagne og alt andet på salget røres ikke. De 133 rækker uden mødetype ændres ikke.
2. **Tørkørsel af rematch** på Lederne-produktet fra 7. september. Jeg viser hvor mange linjer der ændrer beløb, og til hvad, før noget skrives.
3. **Rematch for alvor** efter din bekræftelse af tørkørslens tal.

Forventet resultat: 84 salg går fra 75 kr til 90 kr provision (Onlinemøde), 4 salg går fra 75 kr til 30 kr (Telefonmøde). Omsætningen bliver 200 kr på alle — uændret. De resterende Lederne-salg uden mødetype bliver ved 75/200 kr, som de skal.

Bagefter uploader du selv arket i Bulk Salg, så de rækker der endnu ikke er oprettet, kommer ind. De får mødetypen med automatisk ved import, fordi bulk-importen læser kolonnen.

## Teknisk

- Verificeret read-only: kampagne `Tryg Products` (`874e09c2…`), produkt `Lederne` (`900fd5ad…`), begge regler aktive fra 2026-09-07 (Tlfmøde 30/200 prioritet 1, Onlinemøde 90/200 prioritet 0) med korrekte betingelser på `Hvilket type møde`. Alle 88 Emne-ID'er findes som `sales.raw_payload->>'subject_id'`.
- Punkt 1: `UPDATE sales SET raw_payload = jsonb_set(raw_payload, '{data,Hvilket type møde}', <værdi>)` betinget på `source='manual_entry'`, `client_campaign_id='874e09c2…'`, `sale_datetime >= '2026-09-07'` og eksakt subject_id-match. Kun de 88 rækker fra arket, indsat som eksplicit værdiliste. Ingen skema-, RLS- eller kodeændring, ingen migration.
- Punkt 2/3: eksisterende `rematch-pricing-rules` med `product_id=900fd5ad…` og `min_sale_datetime=2026-09-07T00:00:00`, først `dry_run: true`. Motoren er uændret; ingen deploy.
- Manuelle låse respekteres (`manual_pricing_lock`) — der er ingen låste Lederne-linjer i perioden.
- Rød zone (provisionsgrundlag). Ændringen er begrænset til Lederne-linjer fra 7. september og berører ikke andre klienter, produkter, lønsider eller historiske tabeller. Før/efter-tal rapporteres.
