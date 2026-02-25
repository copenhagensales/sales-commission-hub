

## Tilføj ID-kolonne til leverandørrapporter (UI + PDF)

### Hvad ændres

Lokationens `external_id` (det felt du lige har tilføjet — "ID (valgfrit)") skal vises som en ekstra kolonne i leverandørrapport-tabellen og inkluderes i PDF-eksporten.

### Teknisk plan (2 filer)

**1. `src/components/billing/SupplierReportTab.tsx`**

- Tilføj `external_id` til booking-query's location-select (linje 94): `location(id, name, address_city, daily_rate, type, external_id)`
- Samme for YTD-query (linje 115)
- Tilføj en "ID" kolonne-header efter "Lokation" i tabellen (linje 438)
- Tilføj `TableCell` med `loc.location?.external_id || "-"` i tabelrækken
- Opdatér `colSpan` i footer fra 7 til 8
- Tilføj `externalId` til PDF-config mapping (linje 662) og reportData (linje 310)

**2. `src/utils/supplierReportPdfGenerator.ts`**

- Tilføj `externalId?: string` til `LocationRow` interface
- Tilføj en "ID" kolonne i PDF-tabellens `<colgroup>`, `<thead>`, og i hver `<tr>` (efter lokationsnavnet)
- Opdatér footer `colspan` tilsvarende

### Resultat

- UI-tabellen viser en "ID" kolonne med lokationens `external_id`
- PDF-eksporten inkluderer samme kolonne
- Eksisterende lokationer uden ID viser "-"
