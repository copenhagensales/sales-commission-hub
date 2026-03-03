

## Plan: Ret dagsberegning i faktureringsoversigtens Billing.tsx

**Problem:** `Billing.tsx` bruger `bookedDaysArr.length` — det giver kun antal unikke ugedagstyper (fx 2 for `[2,3]`), ikke det faktiske antal dage over hele perioden. Fx `booked_days: [1,3,5]` over 2 uger burde give 6 dage, men giver kun 3.

**Ændring i `src/pages/vagt-flow/Billing.tsx`:**

1. Tilføj `countBookedDays`-hjælpefunktion (identisk med den i SupplierReportTab) — itererer fra `start_date` til `end_date` og tæller kun dage hvor `getDay()` matcher `booked_days`-arrayet.

2. Erstat begge steder hvor `bookedDaysArr.length` bruges (linje ~102 og ~109) med `countBookedDays(booking)`.

Dette retter dagantal, beløb og dagspris for alle lokationer i den generelle faktureringsosigt.

