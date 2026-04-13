

## Fix: Ukendte lokationer i Økonomi Butikker

### Problem
Når salg har et `fm_location_id` der ikke matcher nogen booking i den valgte periode, opretter koden (linje 349 i `LocationHistoryContent.tsx`) lokationen med navnet "Ukendt lokation" — selvom lokationen faktisk eksisterer i databasen med et rigtigt navn (f.eks. "Frihedens Butikscenter", "Superbrugsen Ølsted").

Det sker fordi lokationsnavne kun hentes via booking-joins. Salg uden booking i perioden har ingen kilde til navnet.

### Løsning
Hent lokationsdata direkte for alle `fm_location_id`'er fra salgsdata der IKKE allerede er dækket af bookings.

### Ændringer i `LocationHistoryContent.tsx`

1. **Ny query**: Efter salesData er loaded, find alle unikke `fm_location_id`'er fra salg der ikke er i `locationIds` (fra bookings). Hent navn, type og daily_rate fra `location`-tabellen for disse.

2. **Brug i aggregering** (linje 349): I stedet for fallback til "Ukendt lokation", slå op i den nye lokations-map for korrekt navn, type og klientnavn.

### Filer
- `src/pages/vagt-flow/LocationHistoryContent.tsx` — tilføj ekstra lokations-query og brug den i salgs-aggregeringen

