

## Problem

When Thomas registers lateness ("forsinkelse") for employees who have individual shifts in the `shift` table, the lateness indicator is **hidden** in the shift overview UI. 

The root cause is in `ShiftOverview.tsx` line 1435:
```tsx
{!hasShift && isLate && (
```

This condition means the lateness tag (orange "Forsinket" badge) is only rendered when there is **no individual shift**. When an employee has both a shift and a lateness record, only the `ShiftCard` is displayed, and `ShiftCard` has no awareness of lateness data.

## Plan

1. **Show lateness indicator alongside shift cards** — In `ShiftOverview.tsx`, add a lateness indicator block that renders when `isLate` is true, regardless of `hasShift`. When both exist, show the shift card AND an orange lateness badge below it.

2. **Update the rendering logic** around lines 1423-1453 to:
   - Keep shift cards rendering as-is when `hasShift` is true
   - Add a separate lateness indicator that shows when `isLate` is true (remove the `!hasShift` guard)
   - The lateness display when `hasShift` is true should be a compact orange badge showing the delay minutes and adjusted time

This ensures that no matter whether an employee has an individual shift or uses standard team times, the lateness registration will always be visible in the shift overview.

