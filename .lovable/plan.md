

## PDF Opdatering: Bookinger-kolonne + Visuelt redesign

### 1. Tilfoej "Bookinger" kolonne til PDF tabellen

**Fil:** `src/utils/supplierReportPdfGenerator.ts`

- Tilfoej `bookings: number` til `LocationRow` interfacet
- Tilfoej en "Bookinger" kolonne i tabel-headeren (mellem "Periode" og "Dage")
- Vis `loc.bookings` i hver raekke
- Opdater subtotal-raekkens `colspan` fra 6 til 7

**Fil:** `src/components/billing/SupplierReportTab.tsx`

- I `downloadSupplierReportPdf`-kaldet (linje ~661): tilfoej `bookings: loc.bookings.length` til location-mapping

### 2. Visuelt redesign af PDF til at matche app-designet

Opdater CSS i `supplierReportPdfGenerator.ts` til et moderne, moerkt tema der matcher appen:

- **Baggrund:** Moerk baggrund (#0f1419) med lys tekst
- **Header:** Stor titel med subtil separator, matching app-font (Inter/system)
- **Tabel:** Moerk tabel med alternerende raekke-farver, afrundede hjoerner, ingen haarfine borders men subtile separatorer
- **Rabatberegning:** KPI-kort med moerk baggrund og accent-farver (groen for rabat, hvid for tal)
- **Badges:** Stilede badges for "Udelukket" (roed) og "Max %" (blaa) som i appen
- **Footer:** Subtil footer med genererings-tidspunkt
- **Print-optimering:** `@media print` regler der sikrer korrekt udskrift (hvid baggrund ved print for laesbarhed)

### Teknisk opsummering
- 2 filer aendres
- Ingen databaseaendringer
- PDF faar ny "Bookinger" kolonne + professionelt dark-theme design
