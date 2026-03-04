

## Problem: "Sidst besøgt" og Cooldown virker ikke

### Årsag

I booking-queryen (linje 126) bruges Supabase-relationen `clients:client_id(id, name)`, som **erstatter** `client_id` med et `clients`-objekt i det returnerede data. Derefter filtrerer koden på `b.client_id` (linje 262, 266), som nu er `undefined`.

Det betyder:
- `lastBooking` er altid `undefined` → "Sidst besøgt" viser altid "-"  
- `weeksSince` er altid 999 → "Uger siden" viser altid "Aldrig"  
- `isInCooldown` er altid `false` → Cooldown-tabet viser altid 0

### Fix

**`src/pages/vagt-flow/BookWeekContent.tsx`** — to ændringer:

1. **Tilføj `client_id` eksplicit i select-queryen** (linje 126):
   ```
   booking(id, client_id, campaign_id, week_number, year, end_date, ...)
   ```

2. **Opdater filteret** til at bruge `b.client_id` (som nu faktisk eksisterer), eller alternativt `b.clients?.id`. Tilføjelse af `client_id` i select er den reneste løsning.

Kun én fil ændres, og det er en ren data-fetching bug.

