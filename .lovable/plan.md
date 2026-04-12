

## Økonomi Butikker — Historisk lokationsoversigt

### Hvad bygges
En ny side/tab der viser **historisk** profitabilitet pr. lokation (butik) på tværs af alle uger. I stedet for at se én uge ad gangen (som den nuværende "Lokationsøkonomi"), aggregerer denne oversigt data over en **valgfri periode** (fx måned, kvartal, år) og rangerer lokationer efter samlet DB.

### Brugeroplevelse
- Datovælger med periode (fra/til eller forudindstillede perioder: "Seneste 3 mdr", "År til dato", "2025")
- KPI-kort: Samlet omsætning, sælgerløn, lokationsomkostning, hotel, diæt, DB, DB%
- Tabel med én række pr. lokation, sorteret efter DB (højeste først):
  - Lokationsnavn, klient-badge, antal bookede uger, omsætning, sælgerløn, lokationsomk., hotel, diæt, DB, DB%
  - Farvekodning: grøn for positiv DB, rød for negativ
- Mulighed for at klikke og se ugeopdeling pr. lokation (expand-row)

### Teknisk tilgang

| Fil | Ændring |
|-----|---------|
| `src/pages/vagt-flow/LocationHistoryContent.tsx` | **Ny fil** — Historisk lokationsprofitabilitet. Genbruger `computeTotals`, `KpiCards`, `TeamBadge`, `formatKr`/`formatPct` fra den eksisterende kode. Henter bookings, sales, hotel, diæt for en hel periode (ikke kun én uge) og aggregerer pr. lokation. |
| `src/pages/vagt-flow/BookingManagement.tsx` | Tilføj ny tab "Økonomi Butikker" med `LocationHistoryContent` (lazy-loaded). |

### Datahentning
- **Bookings**: `booking` filtreret på dato-range (`start_date`/`end_date`) i stedet for uge/år
- **Sales**: `sales` med `source=fieldmarketing` i perioden, joined med `sale_items`
- **Hotel/Diæt**: `booking_hotel` og `booking_diet` for de relevante booking-IDs
- Aggregering sker client-side (samme mønster som eksisterende kode, bare over flere uger)

### Beregning pr. lokation (identisk med eksisterende)
- Omsætning = sum `mapped_revenue`
- Sælgerløn = sum `mapped_commission` × (1 + 12,5% feriepenge)
- Lokationsomk. = `daily_rate` × antal bookede dage
- Hotel + Diæt = fra `booking_hotel`/`booking_diet`
- DB = Omsætning − Sælgerløn − Lokationsomk. − Hotel − Diæt

