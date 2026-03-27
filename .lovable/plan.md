

## Tilføj dato-match visning i Godkendelseskøen

### Problem
Godkendelseskøen viser forskelle på produkter, omsætning og provision — men ikke om datoerne matcher mellem systemets salgsdato og Excel-filens dato.

### Løsning
Udvid `computeDiff` og `ColumnMapping` til at inkludere `date_column`, og vis en dato-sammenligning i "Forskelle"-kolonnen.

### Ændringer

**Fil: `src/components/cancellations/ApprovalQueueTab.tsx`**

1. **Udvid config-fetch** (linje 359): Tilføj `date_column` til SELECT-query fra `cancellation_upload_configs`.

2. **Udvid `ColumnMapping`** (linje 50-55): Tilføj `date_column: string | null`.

3. **Udvid `computeDiff`** (linje 85-157): Tilføj dato-sammenligning:
   - Hent Excel-dato fra `uploadedData[mapping.date_column]`
   - Parse til dato-objekt
   - Sammenlign med salgets `sale_datetime` (kun dato-delen, dd/MM/yyyy)
   - Tilføj en DiffField hvis datoerne er forskellige, eller en "match"-indikation hvis de er ens

4. **Opdater `computeDiff` kald** (linje 402, 446): Send `saleDate` med som parameter, så funktionen har adgang til systemets salgsdato.

5. **Vis dato-match i UI**: I "Forskelle"-kolonnen vises nu også dato-sammenligningen — grøn hvis match, rød hvis afvigelse.

### Teknisk detalje
- `computeDiff` får en ny parameter: `saleDate: string`
- Dato-parsing fra Excel håndterer formater som `dd/MM/yyyy`, `dd-MM-yyyy`, `yyyy-MM-dd`
- For OPP-grupperede rækker bruges den tidligste salgsdato fra gruppen

