

# Erstat liga-beregning med `get_sales_aggregates_v2` RPC

## Problem
Liga-funktionen genimplementerer hele salgsaggregerings-logikken (email-mapping, sale_items joins, product-filtrering, FM-matching) i stedet for at bruge `get_sales_aggregates_v2` RPC'en — den ene sandhed som dagsrapporter bruger. Enhver subtil forskel i joins eller filtrering giver afvigelser. At fikse individuelle edge cases (NULL status, counts_as_sale osv.) er en endeløs kamp.

## Løsning
Erstat hele den custom aggregeringslogik (trin 3-7, ~250 linjer) med ét RPC-kald per medarbejder. RPC'en håndterer allerede: validation_status, counts_as_sale, quantity, agent-mapping, FM work_email fallback — præcis som dagsrapporter.

### `supabase/functions/league-calculate-standings/index.ts`

**Fjern** trin 3-7 (linje 106-348): employee_agent_mapping, agents, email-maps, TM/FM sales queries, sale_items batching, product lookups, saleItemsMap.

**Erstat med** et enkelt RPC-kald via Supabase's `rpc()`:
```ts
// For each enrolled employee, call the RPC with p_employee_id
for (const employeeId of employeeIds) {
  const { data, error } = await supabase.rpc("get_sales_aggregates_v2", {
    p_start: sourceStart,
    p_end: sourceEndRaw + "T23:59:59",
    p_employee_id: employeeId,
    p_group_by: "none",
  });
  
  const row = data?.[0];
  standingsData.push({
    employee_id: employeeId,
    current_provision: Number(row?.total_commission) || 0,
    deals_count: Number(row?.total_sales) || 0,
    overall_rank: 0,
    projected_division: 1,
    projected_rank: 1,
  });
}
```

**Batch for performance**: kald RPC'en i batches af 10 parallelle requests (Promise.all) for at undgå timeout med mange spillere.

**Behold** trin 8-11 (ranking, previous_rank rotation, upsert, cleanup) — de er korrekte.

### `supabase/functions/league-process-round/index.ts`
Samme refaktor: erstat custom aggregering med `get_sales_aggregates_v2` RPC-kald for konsistens i runde-beregninger.

## Effekt
- Liga bruger **præcis samme kode** som dagsrapporter — én sandhed
- Alle fremtidige ændringer i RPC'en (nye filtre, mappings) gælder automatisk for ligaen
- ~250 linjer custom kode fjernes og erstattes med ~30 linjer

| Fil | Ændring |
|-----|---------|
| `supabase/functions/league-calculate-standings/index.ts` | Erstat trin 3-7 med `get_sales_aggregates_v2` RPC-kald |
| `supabase/functions/league-process-round/index.ts` | Samme RPC-refaktor |

