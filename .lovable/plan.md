

## Draft-booking workflow

### Problemet
Når en booking oprettes, er den med det samme "live" — synlig for alle, tæller i fakturering og leverandørrapporter. Lederen ønsker at kunne lave en foreløbig plan (draft), gennemgå den, og først derefter bekræfte og offentliggøre.

### Løsning
Genindføre en `status`-kolonne på `booking`-tabellen med to tilstande: **`draft`** og **`confirmed`**. Drafts er kun synlige for ledere og ignoreres af fakturering/leverandørrapporter.

### Database-ændring

```sql
ALTER TABLE public.booking 
  ADD COLUMN status text NOT NULL DEFAULT 'draft';

-- Eksisterende bookings sættes til confirmed
UPDATE public.booking SET status = 'confirmed' WHERE status = 'draft';

-- Fremadrettet: nye bookings starter som draft
ALTER TABLE public.booking ALTER COLUMN status SET DEFAULT 'draft';
```

### Berørte områder

1. **BookWeekContent.tsx** — Ny booking indsættes med `status: 'draft'`. Tilføj en "Bekræft uge"-knap der batch-opdaterer alle drafts for en given uge til `confirmed`.

2. **Draft-indikator i UI** — Bookings med `status = 'draft'` vises med en visuel markering (f.eks. stiplet kant, gul badge "Kladde") så det er tydeligt at de ikke er bekræftede endnu.

3. **Fakturering / Leverandørrapport** — Filtrér `WHERE status = 'confirmed'` så drafts ikke tæller med i omsætning eller leverandørafregning.

4. **Vagtplan (medarbejdere)** — Vis kun `confirmed` bookings til almindelige medarbejdere. Ledere kan se begge.

5. **Bekræftelses-flow** — En dedikeret "Uge-oversigt" sektion hvor lederen kan:
   - Se alle drafts for en uge samlet
   - Fjerne/redigere inden bekræftelse
   - Trykke "Bekræft alle" for at publicere hele ugen

### Teknisk plan

| Trin | Fil/Område | Ændring |
|------|-----------|---------|
| 1 | Database migration | Tilføj `status text DEFAULT 'draft'`, opdater eksisterende til `confirmed` |
| 2 | `BookWeekContent.tsx` | Insert med `status: 'draft'`, tilføj "Bekræft uge" knap |
| 3 | `BookWeekContent.tsx` | Visuel draft-indikator (badge/styling) på draft-bookings |
| 4 | Fakturering (`SupplierReportTab.tsx`, `Billing.tsx`) | Tilføj `status = 'confirmed'` filter |
| 5 | Vagtplan-queries | Filtrér baseret på rolle: medarbejdere ser kun confirmed |
| 6 | Booking-oversigter (`BookingsContent.tsx`) | Vis status-badge, tillad bulk-bekræftelse |

