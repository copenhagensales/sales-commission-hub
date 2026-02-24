

# Download leverandorrapport som PDF

## Oversigt
Tilfoej en "Download PDF" knap til leverandorrapporten, som genererer en paen, laeselig PDF-fil med alle relevante data -- klar til at sende til leverandorer.

## PDF indhold
PDF-filen vil indeholde:
- **Header**: "Leverandorrapport: [type]" + periode (maaned/aar)
- **Bookings-tabel**: Lokation, By, Kunde, Periode, Dage, Dagspris, Belob (+ rabat/efter rabat for annual_revenue typer)
- **Subtotal**
- **Rabatberegning**: Unikke placeringer eller kumulativ aarsomsaetning, rabattrin, rabatbelob, total efter rabat
- **Undtagelser** (hvis relevante): Liste over lokationer med saerlige vilkaar
- **Footer**: Genereringsdato

## Teknisk tilgang
Bruger browser print-to-PDF (samme pattern som `contractPdfGenerator.ts`):
1. Aabner et nyt vindue med et formateret HTML-dokument
2. Trigger automatisk printdialog, som tillader gem som PDF

### Nye filer
- `src/utils/supplierReportPdfGenerator.ts` -- funktion der tager rapportdata og genererer print-venlig HTML

### AEndringer
- `src/components/billing/SupplierReportTab.tsx` -- tilfoej "Download PDF" knap ved siden af "Godkend rapport" knappen

## Detaljer

### supplierReportPdfGenerator.ts
- Funktion: `downloadSupplierReportPdf(config)` der modtager:
  - `locationType` (string)
  - `month` (string, f.eks. "februar 2026")
  - `locations` (array med lokation, by, kunde, periode, dage, dagspris, belob, rabat, finalAmount, isExcluded, maxDiscount)
  - `discountType` ("placements" | "annual_revenue")
  - `totals` (subtotal, discountAmount, finalAmount)
  - `discountInfo` (unikke placeringer, rabattrin, ytdRevenue)
  - `exceptions` (array)
- Genererer et professionelt HTML-dokument med A4-venlig styling
- Inkluderer firmanavn/logo-plads i header
- Automatisk `window.print()` ved load

### SupplierReportTab.tsx
- Tilfoej `Download`-ikon import fra lucide-react
- Tilfoej "Download PDF" knap i bunden ved siden af godkend-knappen
- Knappen kalder `downloadSupplierReportPdf()` med data fra komponentens state

