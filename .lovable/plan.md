

## Fix: Brug `shift`-tabellen til vagter i stedet for `booking_assignment`

### Problem
Forecast-hooket bruger `booking_assignment` til at tælle vagter — men den tabel er kun til fieldmarketing-bookinger. Almindelige teams bruger `shift`-tabellen. Resultatet er at alle medarbejdere har 0 vagter og klassificeres som "Ny".

### Løsning

**Fil: `src/hooks/useClientForecast.ts`** — to ændringer:

1. **Totalt antal vagter (ny/etableret-klassifikation)**: Hent fra **`shift`**-tabellen i stedet for `booking_assignment`. Tæl alle historiske vagter pr. medarbejder for at afgøre om de er over threshold.

2. **Resterende vagter (projected)**: Hent fremtidige vagter fra **`shift`**-tabellen (efter cutoff, inden månedsslut) i stedet for `booking_assignment`.

Begge queries beholder samme struktur — kun tabelnavnet ændres fra `booking_assignment` til `shift`.

### Berørte filer
- `src/hooks/useClientForecast.ts` — ændr 2 queries fra `booking_assignment` → `shift`

