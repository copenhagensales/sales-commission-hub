

## Fix: Oplæringsbonus forsvinder efter tilføjelse

### Problem identificeret
Der er **to bugs** i `BookingsContent.tsx` relateret til `booking_diet`-tabellen:

**Bug 1 (hovedårsag):** `removeDietFromDayMutation` (linje 644-648) sletter ALLE `booking_diet`-rækker for en given booking+dato **uden at filtrere på `salary_type_id`**. Når nogen fjerner en diæt fra en dag, slettes oplæringsbonussen for samme dag også.

```text
// Nuværende kode (sletter ALT for booking+dato):
.delete()
.eq("booking_id", bookingId)
.eq("date", date)

// Mangler:
.eq("salary_type_id", dietSalaryType.id)
```

**Bug 2:** `addDietToDayMutation` (linje 626) bruger `onConflict: "booking_id,employee_id,date"` (3 kolonner), men den faktiske unique constraint er på 4 kolonner: `(booking_id, employee_id, date, salary_type_id)`. Dette kan forårsage uventet opførsel ved upsert.

### Løsning

**1. Fix `removeDietFromDayMutation` i `BookingsContent.tsx`**
- Tilføj `.eq("salary_type_id", dietSalaryType.id)` til delete-kaldet, så kun diæt-rækker slettes — ikke oplæringsbonusser

**2. Fix `addDietToDayMutation` i `BookingsContent.tsx`**
- Ret `onConflict` fra `"booking_id,employee_id,date"` til `"booking_id,employee_id,date,salary_type_id"` så den matcher den faktiske unique constraint

### Berørte filer
- `src/pages/vagt-flow/BookingsContent.tsx` — 2 rettelser (linje 626 og 644-648)

