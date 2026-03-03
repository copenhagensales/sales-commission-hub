

## Problem

The `booking_vehicle_id` column on `vehicle_return_confirmation` has a NOT NULL constraint. The updated mutation no longer sends `booking_vehicle_id` (it uses `booking_id` + `vehicle_id` instead), causing the insert to fail with: `null value in column "booking_vehicle_id" violates not-null constraint`.

## Fix

1. **Database migration** — Make `booking_vehicle_id` nullable:
   ```sql
   ALTER TABLE public.vehicle_return_confirmation 
     ALTER COLUMN booking_vehicle_id DROP NOT NULL;
   ```

2. No frontend changes needed — the mutation code is already correct.

