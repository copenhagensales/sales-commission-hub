

## Problem

The primary client selector in "Fordel medarbejdere" only lists clients assigned to the current team (`teamClients`). Cross-team client assignments are not possible for the primary selection.

## Solution

Update `EmployeeClientRow` to show **all active clients** in the primary dropdown, not just team clients. Team clients will be shown first, with a visual separator, followed by other available clients.

### Changes

**File: `src/components/employees/TeamAssignEmployeesSubTab.tsx`**

1. Pass `allClients` to `EmployeeClientRow` (already fetched on line 67-78).
2. In the primary `<Select>`, replace `teamClients.map(...)` with a grouped list:
   - **Group 1**: Team clients (labeled "Teamets kunder")
   - **Group 2**: Other clients (labeled "Andre kunder")
   - Uses `SelectGroup` and `SelectLabel` from the select component for grouping.
3. Update the `EmployeeClientRow` props to accept `allClients`.

This is a small, focused change — only the primary dropdown rendering and its props need updating. The secondary dropdown already works correctly with all clients.

