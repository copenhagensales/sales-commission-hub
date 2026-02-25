

## Tilføj lønperiode-valg til Faktureringsrapport

### Hvad ændres

Periode-vælgeren i leverandørrapporten udvides med et nyt valg: **Lønperiode (15.–14.)**. I dag kan man kun vælge hele måneder. Med denne ændring kan brugeren skifte mellem "Måned" og "Lønperiode", og datoerne beregnes automatisk.

Eksempel: "Lønperiode februar 2026" = 15. januar 2026 – 14. februar 2026.

### Teknisk plan (1 fil)

**`src/components/billing/SupplierReportTab.tsx`**

1. **Ny state**: Tilføj `periodType` state med værdier `"month"` og `"payroll"`.
2. **Ny UI-toggle**: Tilføj en Select-komponent før måned-vælgeren, der lader brugeren vælge mellem "Måned" og "Lønperiode".
3. **Beregning af datoer**: Erstat den faste `monthStart`/`monthEnd`-logik med en betinget beregning:
   - `"month"`: Uændret (1.–ultimo).
   - `"payroll"`: `periodStart = 15. i forrige måned`, `periodEnd = 14. i valgte måned`.
4. **Opdatér labels**: Når "Lønperiode" er valgt, vis f.eks. "Lønperiode februar 2026" i stedet for "februar 2026" i overskrifter og PDF.
5. **Opdatér query keys**: Inkludér `periodType` i alle relevante query keys, så data genindlæses korrekt ved skift.
6. **YTD-beregning**: Tilpas `yearStart` til at starte fra 15. januar ved lønperiode-mode, så YTD-summen følger samme logik.
7. **PDF-label**: Send den korrekte periode-label til `downloadSupplierReportPdf` så PDF'en afspejler den valgte periodetype.

### Eksempel på datoberegning

```text
periodType = "payroll", selectedMonth = "2026-02"
→ periodStart = 2026-01-15
→ periodEnd   = 2026-02-14

periodType = "month", selectedMonth = "2026-02"
→ periodStart = 2026-02-01
→ periodEnd   = 2026-02-28
```

### Ingen database-ændringer

Alt beregnes client-side ud fra den valgte måned + periodetype. Eksisterende bookinger filtreres med de nye datoer.
