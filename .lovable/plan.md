# Skjul et produkt for FM-sælgere uden at miste historik

## Sådan ser det ud i dag

- Sælgernes produktliste i Salgsregistrering hentes i `src/pages/vagt-flow/SalesRegistration.tsx:252-272`. Forespørgslen filtrerer **kun** på `client_campaign_id` og `name != 'Lokation'` — der er **ingen** filtrering på `is_active`. Et deaktiveret produkt bliver derfor stadig vist for sælgerne.
- `is_hidden` på `products` bruges udelukkende i MG Test-oversigten (`src/pages/MgTest.tsx:772`) — det har ingen effekt på sælgernes registrering.
- DB-triggeren `create_fm_sale_items` matcher produktnavn med `AND is_active = true`. Deaktiverer man et produkt uden at fjerne det fra listen, kan sælgeren stadig registrere salget, men der bliver **ikke** oprettet `sale_items` — salget lander i `integration_logs` som "Unmatched product name" og giver 0 kr i provision/omsætning. Det er den værste af alle udfald.
- Historik er sikker uanset hvad: eksisterende `sale_items` har allerede `mapped_commission`/`mapped_revenue` gemt og bliver ikke genberegnet af at produktet deaktiveres.

## Anbefalet fremgangsmåde

Rigtig rækkefølge fremover: **først** gør `is_active` styrende for sælgerlisten, **derefter** deaktiver produktet i MG Test.

## Ændring der skal laves

`src/pages/vagt-flow/SalesRegistration.tsx` (produktforespørgslen, linje 252-272):

- Tilføj `.eq("is_active", true)` til forespørgslen.
- Udvid `queryKey` er ikke nødvendig (kampagne-id er allerede nøgle).

Det gør `is_active = false` til den ene, entydige måde at skjule et FM-produkt: sælgeren kan ikke længere vælge det, og triggeren kan ikke længere ramme et halvt-dødt produkt.

## Arbejdsgangen for dig bagefter

1. MG Test → find produktet → sæt det inaktivt (`is_active = false`).
2. Produktet forsvinder fra sælgernes registrering ved næste indlæsning.
3. Alle tidligere salg beholder navn, provision og omsætning i `sale_items` og dagsrapporter — intet genberegnes.
4. Ønsker du det også væk fra MG Test-listen, sæt derudover `is_hidden = true` (rent visuelt filter).

## Zone og omfang

- Grøn/gul zone: én frontend-forespørgsel i FM-booking (ikke pricing). Ingen ændringer i `create_fm_sale_items`, ingen migration, ingen data slettes.
