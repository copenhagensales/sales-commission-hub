

## Draft-booking workflow ✅

### Implementeret
1. ✅ Database: `status text DEFAULT 'draft'` tilføjet til `booking`-tabellen. Eksisterende bookings sat til `confirmed`.
2. ✅ `BookWeekContent.tsx`: Nye bookings oprettes med `status: 'draft'`. "Bekræft uge"-knap batch-opdaterer drafts.
3. ✅ `SupplierReportTab.tsx`: Filtrerer kun `confirmed` bookings i leverandørrapporter.
4. ✅ `Billing.tsx`: Filtrerer kun `confirmed` bookings i fakturering.
