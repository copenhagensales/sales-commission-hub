
# Fix: DB Oversigt viser alle nuller

## Problem
`DBOverviewTab` slaar medarbejdere op med deres **employee UUID** (`aggregatesByEmployee[employeeId]`), men salgsdata fra aggregeringshooket er grupperet efter **agent email**. De matcher aldrig, saa alle vaerdier bliver 0.

## Loesning
Opdater den server-side RPC-funktion (`get_sales_aggregates_v2`) til at returnere `employee_id` som group_key i stedet for `agent_email`, naar der grupperes efter medarbejder. RPC'en har allerede adgang til `eam.employee_id` via JOIN'et med `employee_agent_mapping`.

Derudover opdateres client-side fallback-logikken i `useSalesAggregatesExtended.ts` til ogsaa at lave opslagning via employee_id.

## Aendringer

### 1. Database-migration: Opdater RPC `get_sales_aggregates_v2`
- Aendre `group_key` for 'employee' og 'both' fra `agent_email` til `COALESCE(eam.employee_id::TEXT, agent_email)`
- `group_name` beholdes som foer (baseret paa email/navn)
- Dette sikrer at `byEmployee` indekseres med employee UUID, som `DBOverviewTab` forventer

### 2. Opdater client-side fallback i `useSalesAggregatesExtended.ts`
- I fallback-funktionen (`fetchAndCalculateClientSide`): hent `employee_agent_mapping` for at mappe agent_email -> employee_id
- Indekser `byEmployee` med employee_id i stedet for email
- Sikrer konsistens mellem RPC- og fallback-kodevejene

### Tekniske detaljer
- RPC'en JOINer allerede `employee_agent_mapping`, saa `eam.employee_id` er tilgaengelig uden ekstra JOINs
- `COALESCE` sikrer at salg uden employee-mapping stadig vises (med email som fallback)
- Ingen aendringer i `DBOverviewTab.tsx` er noedvendige - den bruger allerede korrekt employee UUID
