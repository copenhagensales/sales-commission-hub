

# Trin 5: Team Performance RPC + Frontend Swap

## Maal

Erstatte de ~300 linjer client-side logik (CphSalesDashboard linje 512-814) med et enkelt RPC-kald. Dette reducerer 8+ separate database-queries og tusindvis af raekker til 1 query der returnerer ~10 raekker JSONB.

## Del A: Database RPC -- `get_team_performance_summary(p_date date)`

Opret en `SECURITY DEFINER` funktion der udforer praecis samme logik som frontend:

### Dataflow i RPC'en

```text
teams (excl. "Stab")
  + team_members -> employee count + employee-to-team map
  + agents + employee_agent_mapping -> agent-email-to-employee map
  + team_clients + clients -> team-to-client-names map
  + sales (month range, validation_status != 'rejected')
    + sale_items + products (counts_as_sale = true)
    -> aggregate by team for day/week/month
    -> aggregate by team+client for day/week/month
  + absence_request_v2 (approved, sick/vacation only)
    -> count work-day overlaps for day/week/month per team
```

### Sikkerhed (review punkt 6)
- `SECURITY DEFINER` med `SET search_path TO 'public'`
- Foerste linje: `IF NOT (is_teamleder_or_above(auth.uid()) OR is_owner(auth.uid())) THEN RAISE EXCEPTION 'Access denied'`

### Agent-mapping fallback (review punkt 5)
Matcher frontend linje 618-656:
1. Exakt email match
2. Email prefix (foer @)
3. agent_name match
4. agent_name som email prefix

### Absence-beregning
Matcher frontend linje 718-771:
- Beregner overlappende arbejdsdage (excl. weekend) mellem fravarsperiode og dag/uge/maaned
- Kun `sick` og `vacation` typer
- Kun `approved` status

### Return-struktur (JSONB array)
```text
[
  {
    "id": "team-uuid",
    "name": "Team Alpha",
    "employeeCount": 8,
    "sales": { "day": 5, "week": 22, "month": 87 },
    "clients": [
      { "clientName": "Eesy", "sales": { "day": 2, "week": 10, "month": 40 } }
    ],
    "sick": { "day": 1, "week": 3, "month": 8 },
    "vacation": { "day": 0, "week": 2, "month": 5 }
  }
]
```

**Work days** beregnes stadig client-side (countWorkDaysInPeriod) da dette afhaenger af JavaScript Date-logik og ikke aendres.

## Del B: Frontend swap i CphSalesDashboard.tsx

### Trin 1: Side-by-side validering (midlertidig)

Behold den eksisterende query men tilfoej en parallel RPC-kald med console.log sammenligning:

```text
// Ny RPC-query (parallel)
const { data: rpcTeamData } = useQuery({
  queryKey: ["team-perf-rpc", todayStr],
  queryFn: async () => {
    const { data } = await supabase.rpc("get_team_performance_summary", { p_date: todayStr });
    return data;
  },
  staleTime: 30000,
});

// Log comparison in useEffect
useEffect(() => {
  if (teamPerformanceData && rpcTeamData) {
    console.log("[TeamPerf] Client-side:", teamPerformanceData);
    console.log("[TeamPerf] RPC:", rpcTeamData);
  }
}, [teamPerformanceData, rpcTeamData]);
```

### Trin 2: Swap (efter validering)

Erstat linje 512-818 med:

```text
const { data: teamPerformanceData } = useQuery({
  queryKey: ["cph-dashboard-team-performance-v2", todayStr],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("get_team_performance_summary", { p_date: todayStr });
    if (error) throw error;
    // Add workDays client-side (same as before)
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const workDaysDay = countWorkDaysInPeriod(today, today);
    const workDaysWeek = countWorkDaysInPeriod(weekStart, today);
    const workDaysMonth = countWorkDaysInPeriod(startOfMonth(today), today);
    const totalWeek = countWorkDaysInPeriod(weekStart, endOfWeek(today, { weekStartsOn: 1 }));
    const totalMonth = countWorkDaysInPeriod(startOfMonth(today), endOfMonth(today));
    return (data || []).map(t => ({
      ...t,
      workDays: { day: workDaysDay, week: workDaysWeek, month: workDaysMonth, totalWeek, totalMonth }
    }));
  },
  refetchInterval: 60000,
  staleTime: 30000,
});
```

Dette fjerner 8 `fetchAllRows`-kald, batch-loopet over sale_items, og al client-side aggregering.

## Teknisk detalje: SQL-implementering

RPC'en bliver ca. 120 linjer SQL med:

1. **CTE `active_teams`**: `SELECT id, name FROM teams WHERE name != 'Stab'`
2. **CTE `team_emp`**: Join `team_members` med `teams` for employee count og mapping
3. **CTE `agent_map`**: Join `agents` + `employee_agent_mapping` for email/name -> employee_id
4. **CTE `month_sales`**: Sales i maaneds-range med `validation_status != 'rejected'`
5. **CTE `sale_counts`**: Join `sale_items` + `products` (counts_as_sale), aggregate quantity
6. **CTE `team_sale_agg`**: Map via agent_map -> employee -> team, aggregate day/week/month
7. **CTE `client_sale_agg`**: Same men grouped by client via `client_campaigns -> clients`
8. **CTE `absence_agg`**: `absence_request_v2` approved sick/vacation, count work-day overlaps
9. **Final SELECT**: Combine all CTEs into JSONB array med `jsonb_build_object` + `jsonb_agg`

Agent-matching i SQL bruger `COALESCE` med fallback:
```text
COALESCE(
  agent_map_by_email.employee_id,
  agent_map_by_prefix.employee_id,
  agent_map_by_name.employee_id
)
```

## Filer der aendres

| Fil | Aendring |
|-----|---------|
| SQL migration (ny) | Opret `get_team_performance_summary` RPC |
| `src/pages/dashboards/CphSalesDashboard.tsx` | Erstat linje 512-818 med RPC-kald + workDays |

## Filer der IKKE roeres

- `TeamPerformanceTabs.tsx` (uaendret -- modtager samme datastruktur)
- Alle andre dashboard-komponenter
- Edge functions

## Implementeringsplan

1. Opret RPC via SQL migration
2. Tilfoej side-by-side validering (RPC + eksisterende query)
3. Verificer at tallene matcher
4. Swap til kun RPC
5. Fjern ubrugte imports (`fetchAllRows` etc.)

## Forventet effekt

| Metrik | Foer | Efter |
|--------|------|-------|
| DB queries per load | 8+ | 1 |
| Raekker overfoert | ~8.000+ | ~10 (JSONB) |
| Client-side processing | ~300 linjer | ~15 linjer |
| Latency | ~2-3s | ~200-400ms |

## Risiko

| Risiko | Mitigation |
|--------|------------|
| RPC-logik afviger fra frontend | Side-by-side validering foer swap |
| Agent-matching edge cases | Samme 4-level fallback som frontend |
| Weekend/absence overlap fejl | Work-day counting i SQL matcher frontend-logik |

