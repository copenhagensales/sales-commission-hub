

## Bulk-ændring af lønperiode på alle godkendte sager

### Problem
I dag kan man kun ændre "Trækkes i" (deduction_date) én ad gangen via en kalender-popover på hver række. Brugeren vil gerne kunne ændre lønperioden for **alle** (filtrerede) sager på én gang.

### Løsning
Tilføj en "Ændr alle" knap ved siden af header-kolonnen "Trækkes i", der åbner en kalender-popover. Når en dato vælges, opdateres `deduction_date` for alle filtrerede godkendte sager i ét batch-kald.

### Ændringer — `src/components/cancellations/ApprovedTab.tsx`

**A) Tilføj bulk-mutation**
- Ny `useMutation` der tager en liste af IDs + en dato og kører batch-update på `cancellation_queue.deduction_date` for alle IDs.

**B) Tilføj "Ændr alle" knap i header**
- Ved siden af søg/filter-kontrollerne, tilføj en `Popover` med `Calendar` (same som individuel).
- Knaptekst: "Ændr lønperiode for alle" med `CalendarIcon`.
- Kun aktiv når der er filtrerede godkendte sager.

**C) Batch-update logik**
- Ved dato-valg: hent alle `filtered` items med `status === "approved"`, udtræk deres IDs, og kald bulk-mutation.
- Supabase `.update()` med `.in("id", ids)` for at opdatere alle på én gang.
- Toast med antal opdaterede sager.

### Scope
- Kun `ApprovedTab.tsx`
- Ingen databaseændringer

