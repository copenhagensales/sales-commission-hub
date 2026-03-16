


## Draft-booking workflow ✅

### Implementeret
1. ✅ Database: `status text DEFAULT 'draft'` tilføjet til `booking`-tabellen. Eksisterende bookings sat til `confirmed`.
2. ✅ `BookWeekContent.tsx`: Nye bookings oprettes med `status: 'draft'`. "Bekræft uge"-knap batch-opdaterer drafts.
3. ✅ `SupplierReportTab.tsx`: Filtrerer kun `confirmed` bookings i leverandørrapporter.
4. ✅ `Billing.tsx`: Filtrerer kun `confirmed` bookings i fakturering.

## Fortrolige kontrakter ✅

### Implementeret
1. ✅ Database: `is_confidential BOOLEAN DEFAULT false` tilføjet til `contracts`-tabellen.
2. ✅ `can_access_confidential_contract()` security definer funktion — kun `km@` og `mg@` returnerer `true`.
3. ✅ RLS-policies opdateret: Owners, Teamledere og Rekruttering kan IKKE se fortrolige kontrakter (medmindre autoriseret). Medarbejderen selv kan altid se sine egne.
4. ✅ `SendContractDialog.tsx`: "Fortrolig"-toggle med lås-ikon, kun synlig for km@/mg@.
5. ✅ `Contracts.tsx`: Lås-ikon vises ved fortrolige kontrakter i listen.
