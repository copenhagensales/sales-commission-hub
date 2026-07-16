## Skær headcount-grafen ned til trustworthy periode

### Problem
Grafen viser 12 måneder tilbage, men `employee_master_data` blev først oprettet **december 2025**. Måneder før det er rekonstrueret ud fra bagudfyldte `employment_start_date`-felter og en manuel import af `historical_employment` — ikke målt løbende. Tal som "119 i august" er derfor upålidelige.

### Løsning
Begræns grafen til at starte fra **december 2025** (første måned hvor `employee_master_data` har rigtige rækker). Måneder før det vises ikke.

### Ændringer

**`src/components/company-overview/HeadcountTrendChart.tsx`**
- Erstat den hårdkodede "12 måneder tilbage"-logik med en dynamisk start: første måned = `max(december 2025, 12 måneder tilbage)`.
- Datagrundlaget beholdes uændret (`employee_master_data` + `historical_employment` med `is_staff_employee=false` / Stab-filter). Grunden er at stoppede medarbejdere i dec–jul kun ligger i `historical_employment`, så den kilde er stadig nødvendig for at få rigtige tal for tidligere måneder i det trustworthy vindue.
- Cutoff for aktuel måned = dags dato (bevares).
- Titel/undertekst opdateres til at signalere at grafen viser "siden dec 2025" i stedet for "sidste 12 måneder", så det er tydeligt for læseren.

### Konsekvens
- Grafen viser i dag 8 punkter (dec 25 → jul 26) og vokser med én pr. måned indtil vi rammer 12 punkter (marts 27), hvorefter den ruller som et normalt 12-måneders vindue.
- Ingen data slettes, ingen ny tabel oprettes.

### Ikke omfattet
- Ingen snapshot-tabel eller cron. Hvis vi senere vil have præcise, målte tal fremadrettet, er det en separat opgave.
- Ingen ændringer i KPI-kort eller andre dashboards.
