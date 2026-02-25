

## Tilføj lønperiode-valg til Oversigt-fanen

### Hvad ændres

Oversigt-fanen (`BillingOverviewTab` i `src/pages/vagt-flow/Billing.tsx`) får samme periodetype-toggle som Leverandørrapport-fanen, så brugeren kan vælge mellem "Måned" og "Lønperiode (15.–14.)".

### Teknisk plan (1 fil: `src/pages/vagt-flow/Billing.tsx`)

1. **Ny state** (linje ~32): Tilføj `periodType` state med `"month" | "payroll"`.

2. **Beregning af datoer** (linje ~36-37): Erstat den faste `monthStart`/`monthEnd` med betinget logik:
   - `"payroll"`: `periodStart = 15. i forrige måned`, `periodEnd = 14. i valgte måned`
   - `"month"`: Uændret (1.–ultimo)

3. **Opdatér queries** (linje ~40, 49-50): 
   - Brug `periodStart`/`periodEnd` i stedet for `monthStart`/`monthEnd` i booking-queryen
   - Tilføj `periodType` til query key

4. **Ny UI-toggle** (linje ~148, efter filter-rækken): Tilføj en Select-komponent med "Måned" og "Lønperiode" før måned-vælgeren -- samme mønster som i SupplierReportTab.

### Ingen andre filer ændres

Samme logik som allerede er implementeret i `SupplierReportTab.tsx`, bare kopieret ind i `BillingOverviewTab`.

