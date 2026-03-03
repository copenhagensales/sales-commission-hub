

## Problem

The discount calculation logic is wrong. Currently (line 246-248):

```typescript
const totalPlacements = locationEntries.reduce((sum, loc) => {
  return sum + (loc.totalDays >= minDaysPerLocation ? 1 : 0);  // ← BUG: counts max 1 per location
}, 0);
```

Each location counts as **at most 1 placement**, regardless of how many days it has. So a location with 20 days still counts as just 1 booking for discount purposes.

The correct business rule: **every 5 days at a location = 1 booking**. So 16 days = 3 bookings, 20 days = 4 bookings, etc.

The "Bookinger" column in the table already shows `loc.bookings.length` (number of separate booking records), but the **discount calculation** (`totalPlacements`) ignores this and just checks ≥5 days → 1.

## Current numbers from screenshot

Looking at the table, the "Bookinger" column sums to ~30+, but the discount counter only counts 14 unique locations with ≥5 days.

## Plan

**One change in `src/components/billing/SupplierReportTab.tsx`** (lines 246-248):

Replace the placement calculation from:
```typescript
return sum + (loc.totalDays >= minDaysPerLocation ? 1 : 0);
```
to:
```typescript
return sum + Math.floor(loc.totalDays / minDaysPerLocation);
```

This way:
- 16 days / 5 = 3 bookings
- 20 days / 5 = 4 bookings  
- 4 days / 5 = 0 bookings
- 10 days / 5 = 2 bookings

The same `totalPlacements` variable is used for the discount tier lookup, the KPI display ("Bookinger"), the PDF export, and the database snapshot — so this single fix corrects all of them.

