

## Fleksible tidsvinduer per ugedag

### Idé
I stedet for at alle ugedage deler de samme tidsvinduer, får hver dag sine egne tidsvinduer. Admins kan justere mandag uafhængigt af tirsdag osv.

### Database
Tilføj en ny `jsonb`-kolonne `day_time_windows` til `booking_settings`. Strukturen:
```json
{
  "1": [{"start": "09:00", "end": "12:00"}, {"start": "13:00", "end": "16:00"}],
  "2": [{"start": "10:00", "end": "14:00"}],
  "3": [],
  ...
}
```
Nøglerne er ugedagsnumre (1=Ma, 7=Sø). Tomme arrays = lukket den dag. Den eksisterende `time_windows`-kolonne beholdes som fallback for bagudkompatibilitet.

### UI-ændring (`BookingSettingsTab.tsx`)
- Erstat den nuværende flade tidsvindue-liste med en **per-dag accordion/tabs**-visning
- Hver aktiv ugedag (fra toggles) viser sine egne tidsvinduer med tilføj/fjern
- Knap "Kopiér til alle dage" for hurtigt at sætte samme tider på alle aktive dage
- Weekday-toggles virker stadig — slår man en dag fra, ignoreres dens tidsvinduer

### Backend-ændring (`get-public-availability/index.ts`)
- `getTimeWindows()` modtager dagensnummer og slår op i `day_time_windows[dayNumber]`
- Falder tilbage til `time_windows` hvis `day_time_windows` ikke er sat eller mangler den dag
- `generateDays()` kalder `getTimeWindows(dayOfWeek)` per dag i stedet for én gang

### `public-book-candidate/index.ts`
Ingen ændring nødvendig — den bruger allerede de genererede slots.

### Migration
```sql
ALTER TABLE booking_settings ADD COLUMN day_time_windows jsonb DEFAULT NULL;
```

### Filer der ændres
1. **Migration** — tilføj `day_time_windows` kolonne
2. `src/components/recruitment/BookingSettingsTab.tsx` — per-dag UI
3. `supabase/functions/get-public-availability/index.ts` — per-dag slot-generering

