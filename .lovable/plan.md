

## Diæter vises ikke på vagtplanen — analyse + fix

### Hvad jeg fandt

Fra screenshot + DB-tjek:
- Brugeren ser **Eesy FM, uge 19** (4-10/5) — bookinger Aalborg Storcenter (`da3b2393…`) + Kolding Storcenter (`06ca5c22…`).
- Begge bookinger har **diæter i `booking_diet`** (8 stk på hver, lønart "Diæter" — `e4efc5b4…`) oprettet 20/4 kl. 12:17–12:20, dvs. **før** screenshottet kl. 12:35.
- Skærmbilledet viser **ingen "Diæt"-badges under nogen dage** — hverken Aalborg eller Kolding. Kun bil-badges (Kolding) og hotel-badge (Aalborg).
- Koden i `src/pages/vagt-flow/BookingsContent.tsx` (linje 1280–1321 + 1596) HAR rendering for `dietByBookingDate` og query'en (linje 329–342) ramler korrekt mod `salary_type_id = "Diæter"` via `ilike '%diæt%'`.
- RLS på `booking_diet` er åben for authenticated.

### Sandsynlig rodårsag

Query'en `vagt-booking-diets` er gated på `enabled: allBookingIds.length > 0 && !!dietSalaryType`. **Cache-key indeholder ikke `allBookingIds`**, kun `selectedWeek + selectedYear + dietSalaryType?.id`:

```ts
queryKey: ["vagt-booking-diets", selectedWeek, selectedYear, dietSalaryType?.id]
```

Det betyder at hvis brugeren først lander på siden mens `bookings`/`marketBookings` stadig loader (så `allBookingIds = []`), kører query'en i `enabled: false`-tilstand. Når bookinger så ankommer og `allBookingIds` udvides, **invaliderer cache-key'en ikke** — query'en re-fyrer ikke, og resultatet forbliver det tomme array fra første render. De samme symptomer ville ramme `vagt-booking-training-bonuses` og `vagt-booking-vehicles` (den sidste virker dog i screenshot — men dens key inkluderer `allBookingIds`, se linje 283).

Sammenlign:
- ✅ `vagt-booking-vehicles` key: `[..., selectedWeek, selectedYear, allBookingIds]` — re-fetcher korrekt
- ❌ `vagt-booking-diets` key: `[..., selectedWeek, selectedYear, dietSalaryType?.id]` — re-fetcher ikke når `allBookingIds` ændres
- ❌ `vagt-booking-training-bonuses` key: samme bug

### Fix

Tilføj `allBookingIds` til query-key for begge problematiske queries:

```ts
queryKey: ["vagt-booking-diets", selectedWeek, selectedYear, dietSalaryType?.id, allBookingIds]
queryKey: ["vagt-booking-training-bonuses", selectedWeek, selectedYear, trainingBonusSalaryType?.id, allBookingIds]
```

### Filer der ændres
- `src/pages/vagt-flow/BookingsContent.tsx` (kun query-keys på linje 330 + 346)

### Verificering
- Genindlæs `/vagt-flow/bookings?week=19&year=2026` → "Diæt"-badges skal nu vises under man-tor på begge Eesy FM-bookinger.
- Tilsvarende for "Oplæringsbonus"-badges hvor de findes.
- Nyligt tilføjede diæter (via "Tilføj diæt"-knap) inviderer allerede via mutation `onSuccess` — uændret.

### Hvad jeg IKKE rører
- RLS, lønart-tabel, mutation-logik, andre faner.
- Den tilsvarende rendering i `MyBookingSchedule.tsx` (key inkluderer allerede `bookingIds` — virker).

