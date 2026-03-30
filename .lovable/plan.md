

## Vis og vælg individuelle produkter i Lokaliser salg (kun Eesy TM)

### Problem
Produkter vises som "-" fordi `display_name` er null — navnene ligger i `adversus_product_title`. For Eesy TM skal brugeren kunne vælge et specifikt produkt fra salget.

### Ændringer

**1. `src/components/cancellations/LocateSaleDialog.tsx`**

- Tilføj `clientId` check mod `CLIENT_IDS["Eesy TM"]` for at aktivere produkt-niveau visning
- Udvid `sale_items` select med `id, adversus_product_title`
- Vis produktnavne via `adversus_product_title ?? display_name` (fix for "-" problemet)
- **Kun Eesy TM**: Ekspander hver salgsrække til én række pr. sale_item med individuel "Vælg" knap
- **Andre klienter**: Behold nuværende adfærd (én "Vælg" pr. salg)
- Udvid `onMatch` callback signatur: `onMatch(saleId, row, saleItemTitle?)` — tredje parameter er valgfri
- Søgefeltet inkluderer `adversus_product_title` i søgebare felter

**2. `src/components/cancellations/MatchErrorsSubTab.tsx`**

- Opdater `handleLocalMatch` til at modtage `saleItemTitle`
- Gem `saleItemTitle` i `localManualMatches` state
- I `confirmManualMatchesMutation`: Brug den gemte `saleItemTitle` som `target_product_name` for Eesy TM i stedet for at hente første sale_item blindt
- Vis valgt produktnavn i pending matches sektionen

### Scope
- Kun Eesy TM får produkt-niveau valg
- Andre klienter er upåvirkede
- Ingen databaseændringer

