

## Fix: Header synlighed + valuta-linjeskift i PDF

### Problemer
1. **Header-teksten** er svær at læse mod den mørke baggrund — farven er for tæt på baggrunden.
2. **Beløb-kolonnen** er for smal, så "kr" bryder til ny linje (f.eks. "12.000\nkr").

### Løsning

**Fil:** `src/utils/supplierReportPdfGenerator.ts`

1. **Header mere synlig:**
   - Gør h1 farven lysere/hvid (#ffffff) og øg kontrasten
   - Tilføj evt. lidt mere spacing

2. **Prevent linjeskift i beløb:**
   - Tilføj `white-space: nowrap` til `.num` celler så "12.000 kr" aldrig brydes
   - Reducer font-size på tabellen en smule (11px → 10px) for at give mere plads
   - Sæt en `table-layout: fixed` med passende kolonnebredder, eller alternativt reducer padding i cellerne fra 12px til 8px for at give mere plads til indholdet
   - Gør "Lokation"-kolonnen bredere og de numeriske kolonner smallere men med nowrap

### Teknisk opsummering
- 1 fil ændres: `src/utils/supplierReportPdfGenerator.ts`
- Kun CSS-justeringer, ingen logikændringer

