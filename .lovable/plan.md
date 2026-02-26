

## Vis hotel-detaljer på alle dage + tilføj ind/ud-tidspunkter

### Problem
1. Hotel-adressen og check-in/out datoer vises kun pa den forste vagtdag -- pa de ovrige dage ser medarbejderen kun et badge uden info.
2. Databasen gemmer kun datoer (ikke klokkeslaet) for check-in og check-out.

### Losning

**1. Database: Tilføj tidsfelter (migration)**

Tilføj to nye kolonner til `booking_hotel`:
- `check_in_time` (time, nullable) -- f.eks. "15:00"
- `check_out_time` (time, nullable) -- f.eks. "10:00"

```sql
ALTER TABLE booking_hotel
  ADD COLUMN check_in_time time,
  ADD COLUMN check_out_time time;
```

**2. Fil: `src/pages/vagt-flow/MyBookingSchedule.tsx`**

- Udvid query til ogsa at hente `check_in_time` og `check_out_time`
- Vis hotel-callout pa **alle dage** i hotelperioden (ikke kun check-in dag)
- Callout'et viser altid: hotelnavn, adresse/by, check-in dato+tid, check-out dato+tid, telefon og noter
- Pa check-in og check-out dage tilfojes en ekstra label ("Indtjekning i dag" / "Udtjekning i dag")

**3. Fil: Admin-side (BookingsContent.tsx) -- valgfrit**

- Tilfoej felter for `check_in_time` og `check_out_time` i hotel-tildelingsformularen sa planlaeggere kan indtaste tiderne

### Omfang
- 1 database-migration (2 kolonner)
- 1-2 filer aendres (MyBookingSchedule.tsx + evt. BookingsContent.tsx)
