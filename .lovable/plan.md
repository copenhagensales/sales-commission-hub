

## Problem

Confirmation is currently tied to a specific `booking_vehicle_id` — which is a per-day, per-vehicle record. If two employees share the same vehicle on the last booking day, each has their own `booking_vehicle` row (same `booking_id`, same `vehicle_id`, same `date`). When Employee A confirms, Employee B still sees the unconfirmed callout because their `booking_vehicle_id` is different.

Worse: both could confirm independently, triggering two email notifications to FM leaders for the same car.

## Solution

Change the confirmation lookup from matching on `booking_vehicle_id` to matching on **`booking_id` + `vehicle_id` + `booking_date`**. This way:

1. **When Employee A confirms** → a record is inserted with the `booking_id`, `vehicle_id`, and `date`
2. **Employee B's view** immediately shows the green "Afleveret" state because the query matches on the same booking+vehicle+date combination
3. Only **one** email notification is sent (the first person to confirm)

### Changes

1. **`MyBookingSchedule.tsx`** — Update the confirmation query and lookup:
   - Query `vehicle_return_confirmation` by `booking_date` IN the relevant dates (instead of by `booking_vehicle_id`)
   - Match confirmations using `vehicle_name` + `booking_date` (or add `vehicle_id`/`booking_id` columns)
   - On insert, include `booking_id` and `vehicle_id` so lookups are reliable

2. **Database migration** — Add `booking_id` and `vehicle_id` columns to `vehicle_return_confirmation`:
   - `booking_id UUID REFERENCES booking(id)`
   - `vehicle_id UUID REFERENCES vehicle(id)`
   - Add a unique constraint on `(booking_id, vehicle_id, booking_date)` to prevent duplicate confirmations

3. **Mutation logic** — Use `upsert` or check-before-insert to gracefully handle the case where the other person already confirmed (no error, no duplicate email).

4. **`VehicleReturnCallout`** — No changes needed; it already handles the confirmed/unconfirmed states.

### Result
- First person to click "Bekræft aflevering" → record saved, email sent
- Second person sees green "Afleveret kl. HH:MM" immediately (or after refetch)
- No duplicate emails, no confusion

