

# Fix: Brug konfigureret sælger-kolonne i stedet for gæt

## Problem
Koden gætter sælger-kolonnen via `SELLER_FIELD_CANDIDATES`-listen. Excel-filen har både "Employee Name" (den rigtige sælger) og "Operator" (indeholder "Newly Created", "Call Me" osv.). Fordi "operator" står først i kandidat-listen, vælges den forkerte kolonne — og "Newly Created" gemmes som sælgernavn.

## Løsning
Databasen har allerede en `seller_column` i `cancellation_upload_configs`. Koden henter allerede upload-konfigurationen, men kun `date_column`. Rettelsen:

### Ændringer i `MatchErrorsSubTab.tsx`

1. **Udvid config-query** — Hent `seller_column` sammen med `date_column` fra `cancellation_upload_configs`.

2. **Brug `uploadConfig.seller_column` som primær kilde** — `sellerField` skal sættes til `uploadConfig.seller_column` hvis den findes. Kun fald tilbage til `SELLER_FIELD_CANDIDATES`-gættet hvis `seller_column` ikke er konfigureret.

3. **Ingen andre ændringer** — Resten af logikken (per-row assignment, re-match, queue insertion) forbliver uændret.

## Teknisk ændring
```text
// Før:
.select("date_column")

// Efter:
.select("date_column, seller_column")

// sellerField logic:
const sellerField = useMemo(() => {
  if (uploadConfig?.seller_column) return uploadConfig.seller_column;
  return allKeys.find(k => SELLER_FIELD_CANDIDATES.includes(k.toLowerCase()));
}, [allKeys, uploadConfig]);
```

## Fil
`src/components/cancellations/MatchErrorsSubTab.tsx`

