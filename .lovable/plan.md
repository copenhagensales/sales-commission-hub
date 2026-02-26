

## Fix: Ret kolonnenavn i MyBookingSchedule query

### Problem
Queryen i `MyBookingSchedule.tsx` forsoeger at hente `city` fra `location`-tabellen, men kolonnen hedder `address_city`. Dette giver en 400-fejl fra databasen, og derfor vises ingen vagter.

### Aendring

**`src/pages/vagt-flow/MyBookingSchedule.tsx`**
- Linje 53: Aendr `city` til `address_city` i select-strengen for location
- Linje 148: Aendr `location?.city` til `location?.address_city` i rendering

Det er en enkel to-linjers fix der loeser hele problemet.

