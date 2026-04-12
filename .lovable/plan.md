

## Split leverandørtype-oversigt i Eesy FM og YouSee

### Hvad ændres
Den nuværende "DB/dag pr. leverandørtype" tabel splittes i **to separate tabeller** — én for Eesy FM og én for YouSee — så man kan sammenligne leverandørtype-performance pr. klient.

### Fil: `src/pages/vagt-flow/LocationHistoryContent.tsx`

1. **Opdater `vendorTypeSummary`**: Lav to separate summaries ved at filtrere `locationData` efter `clientName` (samme logik som `eesyLocations`/`youseeLocations` splittet):
   - `vendorTypeSummaryEesy` — kun lokationer med "eesy" i clientName
   - `vendorTypeSummaryYousee` — kun lokationer med "yousee" i clientName

2. **Opdater UI**: Erstat den ene `Card` med to `Card`-komponenter:
   - **"DB/dag pr. leverandørtype – Eesy FM"** med orange accent i titlen
   - **"DB/dag pr. leverandørtype – YouSee"** med blå accent i titlen
   - Samme tabelstruktur (Type, Lokationer, Dage, Salg/dag, 30 dage, 3 mdr, 6 mdr, All time)
   - Vis kun tabellen hvis der er data for den pågældende klient

### Teknisk tilgang
Genbruger den eksisterende `vendorTypeSummary`-logik som en funktion der tager et subset af `locationData`, og kalder den to gange med `eesyLocations` og `youseeLocations`.

