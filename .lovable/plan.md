## Rod-årsag

`sales` har ingen `employee_id` — kun `agent_email` og `agent_external_id`. `useFiberBoardStats` blev skrevet under antagelse af at `sales.employee_id` findes. Resultat: joinet returnerer intet nyttigt (feltet er null/undefined), og alle fiber-rækker droppes i `if (!employeeId) continue`.

Bevis: `information_schema.columns` for `public.sales` viser ingen `employee_id`-kolonne. `useSalesAggregatesExtended.ts:257-272` resolver via `employee_agent_mapping` joined med `agents.email`, hvilket er samme resolver som cached leaderboard bruger for `employeeId`-nøglen.

## Fix

Opdatér `src/hooks/useFiberBoardStats.ts`:

1. Vælg `sales.agent_email` i stedet for `employee_id`.
2. Hent `employee_agent_mapping` (employee_id, agents.email) parallelt.
3. Byg lookup `email.toLowerCase() → employee_id`.
4. For hver `sale_item`: slå employee_id op ud fra `agent_email`. Fallback-key = `agent_email.toLowerCase()` (samme mønster som `useSalesAggregatesExtended`) så sælgere uden mapping stadig aggregeres — de matcher bare ikke ind i cached leaderboard-rækken, men vises som "orphan"-række (allerede understøttet af mergeFiber i ClientDashboard).

Ingen andre filer røres. Ingen DB-migration.

## Zone

Gul (dashboard/hook). Read-only mod `sales`, `sale_items`, `employee_agent_mapping`.
