---
name: Time Clock Entity and Logic Types v2
description: Override, documentation, and revenue clock types with CPO/time revenue calculation
type: feature
---
The 'Stempelur' (Time Clock) functions as a granular addition/override per employee and client via the 'employee_time_clocks' table. Three clock types exist: 'override' (replaces standard shift hours), 'documentation' (logs hours without payroll impact), and 'revenue' (tracks billable hours).

**CPO/time Revenue Calculation:**
- `cpo_per_hour` field on `employee_time_clocks` defines a per-hour revenue rate
- Revenue is calculated automatically: `effective_hours (from time_stamps) × cpo_per_hour = CPO revenue`
- The `useCpoRevenue` hook joins `time_stamps` with `employee_time_clocks` (matching on `employee_id` + `client_id`) to compute revenue
- CPO revenue is added to sales revenue in DB Overview, Daily Breakdown, and Client DB views
- CPO revenue is NOT subject to cancellation percentage adjustments (only sales revenue is)
- CPO/time rate is NOT visible to employees in their time clock view (hidden for privacy)
