

# Fix: Booking kan ikke slettes pga. foreign key constraint

## Problem
Når en booking slettes, fejler det med:
> "update or delete on table 'booking' violates foreign key constraint 'vehicle_return_confirmation_booking_id_fkey' on table 'vehicle_return_confirmation'"

`vehicle_return_confirmation.booking_id` har en FK til `booking(id)` uden `ON DELETE CASCADE`.

## Løsning
Kør en migration der ændrer FK-constrainten til `ON DELETE CASCADE`:

```sql
ALTER TABLE public.vehicle_return_confirmation
  DROP CONSTRAINT IF EXISTS vehicle_return_confirmation_booking_id_fkey,
  ADD CONSTRAINT vehicle_return_confirmation_booking_id_fkey
    FOREIGN KEY (booking_id) REFERENCES public.booking(id) ON DELETE CASCADE;
```

Ingen kodeændringer nødvendige — kun en database-migration.

| Fil | Ændring |
|-----|---------|
| Migration (SQL) | Tilføj `ON DELETE CASCADE` på `vehicle_return_confirmation.booking_id` FK |

