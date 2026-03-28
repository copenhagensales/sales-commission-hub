

## Plan: Spor hvem der tilføjer diæt + vis det i UI

### Problem
`booking_diet` tabellen har ingen `created_by` kolonne, så det er umuligt at se hvem der har påført en diæt. Kun `created_at` tidspunkt findes.

### Ændringer

**1. Database migration** — Tilføj `created_by` kolonne til `booking_diet`
```sql
ALTER TABLE public.booking_diet 
  ADD COLUMN created_by uuid REFERENCES auth.users(id);
```

**2. Upserts i `BookingsContent.tsx`** — Tilføj `created_by: (await supabase.auth.getUser()).data.user?.id` ved indsættelse af diæt (linje ~588-596)

**3. Upserts i `EditBookingDialog.tsx`** — Samme tilføjelse af `created_by` ved diæt-upserts (linje ~976, ~1030)

**4. Query i `BookingsContent.tsx`** — Udvid diæt-query til at hente `created_at, created_by` + join med `employee_master_data` via en separat lookup for at vise navn

**5. UI: Tooltip på Diæt-badge** (2 steder i `BookingsContent.tsx`, linje ~1207 og ~1479)
- Wrap Diæt-badge i `Tooltip` der viser: "Tilføjet af [Navn] kl. HH:mm d. DD/MM"
- Hvis `created_by` er null (ældre data): vis kun `created_at` tidspunkt

### Filer

| Fil | Ændring |
|-----|---------|
| `supabase/migrations/...` | Tilføj `created_by` kolonne |
| `src/pages/vagt-flow/BookingsContent.tsx` | Sæt `created_by` ved upsert, udvid query, tilføj tooltip |
| `src/components/vagt-flow/EditBookingDialog.tsx` | Sæt `created_by` ved upsert |

