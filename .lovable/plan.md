# Alle tryg & alka salg — indhold på den nye fane

## Hvad brugeren får

Fanen "Alle tryg & alka salg" viser en liste over alle salg på kunderne **Tryg** og **ALKA** for én valgt dag — samme kolonner som Kanvas-møder:

- Tid
- Sælgernavn
- Telefon
- Antal
- Produktnavn

Øverst til højre: søgefelt til telefonnummer (samme adfærd som på Kanvas-møder) og dagsvælger.

Fanen har **ingen** statusfaner (Gennemgang / Afviste / Godkendte), **ingen** Afvis/Godkend/Markér-knapper pr. linje, og ingen Kopiér/Skabelon/Send til Tryg/Slet — det er en ren visning.

Nyeste salg står øverst. Der tilføjes en kunde-kolonne, så man kan se om linjen er Tryg eller ALKA.

## Teknisk

- Ny hook `src/hooks/useTrygAlkaSales.ts`: henter `sale_items` med join til `products → client_campaigns → clients` filtreret på kunde-id'erne Tryg (`516a3f67-…`) og ALKA (`0a8048ac-…`) samt `sales.sale_datetime` inden for den valgte dag. Sælgernavn resolves via `employee_master_data.work_email` præcis som i `useTrygKanvasSales`, med fallback til `agent_name`/`agent_email`. Returnerer samme felter som `TrygKanvasSale` plus `clientName`. Kunde-id'erne lægges i konstanter i hooken.
- `src/components/reports/TrygSalesTable.tsx`: ny `mode: "plain"` uden handlings-kolonne og uden markering, med valgfri kunde-kolonne. Eksisterende `review`- og `status`-modes ændres ikke.
- `src/pages/reports/TrygEditSales.tsx`: når `view === "tryg-alka"` vises eget dag- og søgefelt-sæt plus `TrygSalesTable` i `plain`-mode. Kanvas-visningen er uændret. Telefon-søgning genbruger den eksisterende ciffer-normalisering på siden.
- Ingen migrationer, ingen ændringer i RLS, pricing, løn eller eksisterende queries. Læse-only visning.
