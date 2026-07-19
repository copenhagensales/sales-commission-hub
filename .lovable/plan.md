## Mål
Excel-udtræk fra Match-fejl (unmatched rows) med unikke OPP for **Jonathan Gabriel**. Kun fire kolonner: OPP-nummer, Sælgernavn, Solgte produkter, Tilskudssats.

## Datakilde
`cancellation_imports.unmatched_rows` (JSON-array) — samme kilde som "Godkendelseskø → Fejl i match".

Match på sælgernavn: kig i alle sælger-felter (`operator`, `agent`, `sælger`, `agent_name`, `employee_name`, m.fl.) efter "Jonathan Gabriel" (case-insensitive).

## Fremgang
1. Query `cancellation_imports` hvor `unmatched_rows` ikke er null, unnest og filtrér på Jonathan Gabriel.
2. For hver række udtræk:
   - **OPP-nummer** — via samme `extractOpp`-logik som resten af annulleringsmodulet (leadResultFields → leadResultData → top-level → legacy).
   - **Sælgernavn** — det fundne felt.
   - **Solgte produkter** — `_product_rows[].Produkt` (TDC-format) eller mapping-baserede produkt-kolonner med qty > 0 (samlet med komma).
   - **Tilskudssats** — felt "Tilskud" / "Kampagne pris" / `leadResultFields.Tilskud` (0% eller 100%).
3. Dedupér på OPP-nummer (behold første observation).
4. Generér `.xlsx` med én fane, fire kolonner, og lever den i `/mnt/documents/`.

## Leverance
`/mnt/documents/jonathan-gabriel-match-fejl.xlsx` med kolonner:
`OPP-nummer | Sælgernavn | Solgte produkter | Tilskudssats`

Ingen kodeændringer i projektet.