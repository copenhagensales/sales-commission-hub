

## Plan: Optimer PDF-rapport til A4 print med læsbart layout

**Problemer identificeret i den genererede PDF:**
1. `table-layout: fixed` med for snævre procentbredder — tal og tekst flyder ud af celler
2. "Uger & Dage"-kolonnen med badges wrapper dårligt og overlapper naboceller
3. Mørkt tema er uegnet til print/PDF (dårlig kontrast, spild af blæk)
4. Font-størrelser for små, padding for tæt

### Ændringer i `src/utils/supplierReportPdfGenerator.ts`

**1. Skift til lyst print-tema:**
- Hvid baggrund, sort/mørkegrå tekst
- Lyse borders i stedet for mørke baggrunde
- Professionelt udseende til at sende til leverandører

**2. Tabellayout-fix:**
- Fjern `table-layout: fixed` — brug `auto` så kolonner tilpasser sig indhold
- Øg padding i celler (8-10px)
- Sæt `white-space: nowrap` på talkolonner
- Giv "Uger & Dage" kolonnen `min-width` i stedet for fast procentbredde

**3. Weekday-badges optimeret til print:**
- Brug simpel inline tekst med let baggrund i stedet for tætte badges
- Bedre spacing mellem ugerækker

**4. Øg font-størrelse:**
- Body: 11px → 12px
- Tabelceller: 10px → 11px
- Headers: 10px → 11px

**5. Landscape-orientering:**
- Skift `@page` til `size: A4 landscape` for at give mere bredde til tabellen med 9+ kolonner

**6. KPI-kort tilpasset lyst tema:**
- Let grå baggrund, mørk tekst, tydelige borders

### Berørte filer

| Fil | Ændring |
|-----|---------|
| `supplierReportPdfGenerator.ts` | Komplet CSS-overhaul: lyst tema, auto tabel-layout, større fontstørrelser, landscape A4 |

