

## Fix: Leverandørtyper viser "Ukendt"

### Problem
Alle lokationer vises som "Ukendt" i leverandørtype-oversigten. Databasen har korrekte typer (Markeder, Coop butik, etc.), og queryen henter `type` fra `location`-tabellen. Problemet er sandsynligvis at `b.location` objektet ikke parses korrekt, eller at tomme strenge ikke håndteres.

### Ændring i `LocationHistoryContent.tsx`

1. **Tilføj fallback for tom streng**: Linje 324 ændres fra `loc?.type || "Ukendt"` til en eksplicit check der også fanger tomme strenge: `loc?.type?.trim() || "Ukendt"`

2. **Tilføj debug-logging** (midlertidigt): Log det første booking-objekt for at verificere at `location`-relationen returnerer korrekt data med `type`-feltet

3. **Brug eksplicit FK-navn i query**: Ændr `location!inner(...)` til `location!booking_location_id_fkey(...)` for at sikre korrekt relation-matching, da Supabase kan have problemer med at auto-resolve relationen

### Teknisk detalje
- Queryen på linje 175 ændres til: `location:location!booking_location_id_fkey(id, name, daily_rate, type)`
- Dette sikrer at Supabase bruger den korrekte foreign key og returnerer location-objektet med alle felter inkl. `type`

