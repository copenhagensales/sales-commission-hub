

## Problem

The "Husk at medbringe stande og roll-ups" reminder only shows when the assignment date matches the **booking's** `start_date`. If the employee's first shift on that booking is a different day (e.g., they start Tuesday but the booking starts Monday), the reminder never appears.

Same issue for "Husk at tage stande og roll-ups med hjem" — it only shows on the booking's `end_date`, not the employee's last assigned day.

## Solution

Change the logic to determine `isFirstBookingDay` and `isLastBookingDay` based on the **employee's own assignments** for that booking, rather than the booking's overall date range.

## File Change

**`src/pages/vagt-flow/MyBookingSchedule.tsx`** (lines 302-305)

Replace:
```typescript
const isFirstBookingDay = booking?.start_date ? a.date === booking.start_date : false;
const isLastBookingDay = booking?.end_date ? a.date === booking.end_date : false;
```

With logic that finds the employee's first and last assignment dates for this booking across all assignments:
```typescript
const myAssignmentsForBooking = assignments
  ?.filter((ass: any) => ass.booking_id === a.booking_id)
  .map((ass: any) => ass.date)
  .sort() ?? [];
const isFirstBookingDay = myAssignmentsForBooking[0] === a.date;
const isLastBookingDay = myAssignmentsForBooking[myAssignmentsForBooking.length - 1] === a.date;
```

This ensures:
- **First day**: The stand reminder shows on the employee's first assigned shift for that booking
- **Last day**: The "bring home" reminder shows on the employee's last assigned shift

