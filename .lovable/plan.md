

# Fix: Sælger-tildeling per-række (ikke per kolonneværdi)

## Problem
Kolonnen "Employee Name" i upload-filen indeholder sælgernavnet. Alle 13 rækker kan have samme værdi i den kolonne. Når brugeren vælger en medarbejder for én række, matcher systemet på kolonneværdien — og tildeler derfor alle rækker med samme "Employee Name" den samme medarbejder. Det er forkert: brugeren vil tildele per-række.

## Løsning

### Ændringer i `MatchErrorsSubTab.tsx`

1. **Lokal per-række state** — `useState<Record<number, string>>` tracker valgt medarbejder per row-index. Dropdown viser lokal state først, fallback til global mapping.

2. **Mutation arbejder per-række** — Modtager den specifikke `row` + `employeeId`. Gemmer stadig global mapping i `cancellation_seller_mappings` (til fremtidige uploads), men re-match kører KUN for den ene række:
   - Hent `work_email` for valgt medarbejder
   - Parse dato fra rækkens `rowData[dateCol]`
   - Søg i `sales` for match (agent_email + dato + kampagner)
   - Hvis match: insert i `cancellation_queue`, fjern rækken fra `unmatched_rows`

3. **Toast feedback** — "Rækken matchet og sendt til godkendelseskøen" eller "Mapping gemt" hvis ingen salg fundet.

## Fil
`src/components/cancellations/MatchErrorsSubTab.tsx`

