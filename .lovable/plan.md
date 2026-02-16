

## Fix: Forkerte navne og visning i live-mode

### Problem
Nar dashboardet bruger live-data (ved brugerdefineret periode), vises salgernes navne som forkortede email-prafikser (fx "thor", "jani", "jakr") i stedet for fulde navne. Det skyldes at live-queryen bruger `agentEmail.split("@")[0]` som navn.

Derudover mangler avatars og "Switch"-kolonnen i live-mode.

### Losning

**1. Hent medarbejdernavne korrekt i live-mode**
- Udvid den eksisterende `employeeData`-query til ogsa at bygge et opslag fra employee_id og email til fuldt navn
- Brug dette opslag til at erstatte de forkortede navne i `liveSellers`

**2. Tilfoej avatars til live-salgere**
- Brug det eksisterende avatar-map til at saette `avatarUrl` pa live-salgere

**3. Konkrete aendringer i `RelatelDashboard.tsx`:**

- Udvid `employeeData`-queryen til at returnere et `idToNameMap` (employee_id -> fuldt navn) og et `emailToNameMap` (via `employee_agent_mapping`) sa live-data kan oplose rigtige navne
- Opdater `liveSellers` useMemo til at slaa navne og avatars op fra disse maps
- Beholde den eksisterende cached-mode uaendret (den virker korrekt)

### Teknisk detalje

Problemet er i `useSalesAggregatesExtended.ts` linje 302:
```text
name: agentEmail.split("@")[0]  // -> "thor" i stedet for "Thor Jensen"
```

RPC-pathen (`get_sales_aggregates_v2`) returnerer muligvis ogsa kun korte navne. Losningen er at oplose navne i dashboard-komponenten via employee_master_data + employee_agent_mapping, uanset hvad RPC/fallback returnerer.

### Filer der aendres
- `src/pages/RelatelDashboard.tsx` (udvid employee-query + opdater liveSellers mapping)

