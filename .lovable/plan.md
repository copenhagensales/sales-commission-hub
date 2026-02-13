

# Download Excel-knap til FM Dashboard

## Hvad der bygges
En "Download Excel"-knap i headeren paa Fieldmarketing Dashboard, der henter ALLE FM-salg fra databasen og genererer en Excel-fil direkte i browseren.

## Implementering

### 1. Tilfoej eksport-funktion i `FieldmarketingDashboardFull.tsx`

- Importerer `xlsx` (allerede installeret i projektet)
- Importerer `Download`-ikon fra `lucide-react`
- Opretter en `handleExportExcel()` funktion der:
  1. Henter alle salg fra `sales`-tabellen med `source = 'fieldmarketing'` via `fetchAllRows` (pagineret)
  2. Joiner med `client_campaigns` og `clients` for klientnavne
  3. Mapper data til laesbare kolonner: Dato, Saelger, Telefon, Produkt, Klient, Status, Kommentar
  4. Genererer en `.xlsx`-fil med `xlsx.utils.json_to_sheet()` og trigger download

### 2. Tilfoej knap i dashboard-headeren

- Placeres ved siden af dato-vaelgeren i `rightContent`
- Bruger eksisterende `Button`-komponent med `variant="outline"` og `size="sm"`
- Viser loading-spinner under download

### Tekniske detaljer

- Bruger `fetchAllRows` for at omgaa 1000-raekke-graensen
- Henter data on-demand (ikke cached) for at sikre friske data
- Filtrerer IKKE paa klient - eksporterer alle FM-salg paa tvaers af klienter
- Kolonner i Excel: Dato, Saelger, Telefonnummer, Produkt, Klient, Validering, Kommentar

