

## Problem

The "Ændre vagt" (Change shift) button in the cell context menu is only visible when the employee already has work times assigned (`hasWorkTimes`). This means you can't create a custom shift for a day where no shift exists yet — e.g., setting a different time for a future day.

## Plan

1. **Remove the `hasWorkTimes` guard** around the "Ændre vagt" button (line 1576 in `ShiftOverview.tsx`), so the button is always visible in the popover menu.

2. **Adjust the click handler** — it already handles both cases (edit existing shift vs. create new), so no logic change is needed. The existing code at lines 1582-1591 checks `hasShift` and either opens the edit dialog or the create dialog.

This is a one-line change: remove the `{hasWorkTimes && (` wrapper and its closing `)}`.

