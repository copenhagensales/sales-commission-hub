

## To nye handlinger per række i "Fejl i match"

### Hvad bygges

To knapper per række i Match Errors tabellen:

1. **Lokaliser salg** — Åbner en dialog der viser alle salg for den tildelte medarbejder (filtreret på klientens kampagner). Brugeren kan søge og vælge et salg → det kobles til annulleringsrækken (indsættes i `cancellation_queue`, fjernes fra `unmatched_rows`).

2. **Ignorer række** — Knap med to-trins bekræftelse (inline confirm) der fjerner den enkelte række fra `unmatched_rows` uden at koble den til et salg.

### Teknisk plan

**Ny fil: `src/components/cancellations/LocateSaleDialog.tsx`**
- Dialog med søgefelt (fritekst: telefon, firma, sælgernavn)
- Henter salg fra `sales` + `sale_items` filtreret på klientens `campaignIds`
- Hvis en medarbejder er tildelt (via `localAssignments` / `mappingsByName`), pre-filtrerer på `agent_email` / `agent_name` — med toggle til at fjerne filteret
- Tabel med: Dato, Sælger, Telefon, Produkter, Omsætning
- "Vælg" knap per salg → indsætter i `cancellation_queue` med `sale_id`, fjerner rækken fra `unmatched_rows`, invaliderer queries

**Ændring: `src/components/cancellations/MatchErrorsSubTab.tsx`**
- Tilføj ny kolonne "Handlinger" med to knapper:
  - `Lokaliser salg` (søge-ikon) → åbner `LocateSaleDialog` med `row`, `clientId`, `campaignIds`, evt. tildelt `employeeId`
  - `Ignorer` (trash-ikon) → inline two-step: først klik → knappen skifter til "Bekræft?" i rødt, andet klik → fjerner rækken fra `unmatched_rows` i databasen
- Tilføj state for `ignorePendingIdx` til two-step confirm
- Tilføj mutation `ignoreRowMutation` der fjerner én specifik række (genbruger logik fra `ignoreAllMutation` men for én række)

### Berørte filer
- `src/components/cancellations/LocateSaleDialog.tsx` (ny)
- `src/components/cancellations/MatchErrorsSubTab.tsx` (tilføj handlingskolonne + dialog-integration)

