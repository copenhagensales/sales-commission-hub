

## Excel-eksport til Faktureringsrapport

### Hvad der bygges
En "Download Excel"-knap i Billing Overview-tabben der eksporterer den filtrerede tabeldata til en `.xlsx`-fil med samme kolonner som vist i UI'et.

### Teknisk tilgang

**Fil: `src/pages/vagt-flow/Billing.tsx`**

1. Import `xlsx` (allerede installeret) og `Download`-ikon fra lucide
2. Tilføj en `handleExportExcel`-funktion der:
   - Mapper `bookingsByLocation` til rækker med: Lokation, By, ID, Kunde, Uger & Dage (som tekst), Bookinger, Dage, Dagspris, Beløb
   - Opretter et worksheet fra array-of-arrays med header-række
   - Sætter kolonnebredder for læsbarhed
   - Genererer og downloader `.xlsx`-filen med et filnavn der inkluderer periode
3. Placér knappen ved siden af filtrene (øverst i toolbaren)

Uger & Dage-kolonnen formateres som tekst, f.eks. "Uge 6: Man–Fre" eller "Uge 7: Man, Tir, Ons, Fre".

Ingen database-ændringer. Ingen nye dependencies.

