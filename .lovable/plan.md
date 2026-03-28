

## Plan: Auto-beregn Lokationer og Hotel i Udgiftsrapport

### Hvad der bygges

To udgiftsposter i Udgiftsrapporten bliver auto-beregnet fra data i stedet for manuelt indtastet:

1. **Lokationer** — summen af alle bookede lokationers dagspris × antal bookede dage i lønperioden (15.–14.)
2. **Hotel** (ny kategori) — summen af `booking_hotel.price_per_night` i lønperioden

Begge vises som read-only med beregnet beløb og en note der forklarer kilden.

### Ændringer i `src/components/billing/ExpenseReportTab.tsx`

1. **Tilføj "hotel" til EXPENSE_CATEGORIES** (efter "lokationer")

2. **Beregn lønperiode** fra `selectedMonth` (15. i forrige måned → 14. i valgt måned)

3. **Ny query: bookede lokationer i perioden**
   - Hent `booking` med `location(daily_rate)`, filtreret på `start_date`/`end_date` overlap med lønperioden
   - Beregn sum: `(daily_rate_override ?? location.daily_rate ?? 0) × booked_days.length`

4. **Ny query: hoteludgifter i perioden**
   - Hent `booking_hotel` filtreret på `check_in` inden for lønperioden
   - Sum af `price_per_night`

5. **Auto-indsæt i rows** via `useEffect`:
   - Når queries returnerer, sæt `lokationer`-rækken til beregnet sum + note "Auto-beregnet fra bookinger"
   - Sæt `hotel`-rækken til beregnet sum + note "Auto-beregnet fra hotelovernatninger"
   - Disse felter gøres read-only i tabellen (disabled inputs)

### Filer

| Fil | Handling |
|-----|---------|
| `src/components/billing/ExpenseReportTab.tsx` | Tilføj hotel-kategori, 2 queries, auto-populate logic, read-only styling |

### Teknisk detalje

- Lønperiode: `new Date(year, month-2, 15)` → `new Date(year, month-1, 14)` (baseret på selectedMonth)
- Lokationsberegning: `SUM(daily_rate_override ?? location.daily_rate) × booked_days.length` for bookinger der overlapper perioden
- Hotel: `SUM(price_per_night)` fra `booking_hotel` hvor `check_in` er i perioden
- Auto-beregnede rækker er read-only men kan stadig gemmes til databasen for historik

