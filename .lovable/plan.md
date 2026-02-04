
# Plan: Hent salgstal fra KPI Definitioner

## Problemet
ClientDBTab henter salgsdata direkte fra `sales`-tabellen, men:
1. **Mangler fieldmarketing-salg** fra `fieldmarketing_sales` (Eesy FM, Yousee)
2. **Ingen pagination** - risikerer at misse data ved 1000+ rækker
3. **Ignorerer pre-computed KPI-cache** som allerede har korrekte tal

## Løsning: Hybrid tilgang

### Standard perioder → Brug KPI-cache
For "I dag", "Denne uge", "Denne måned" og "Lønperiode" hentes data fra `kpi_cached_values`:

| Periode UI | KPI period_type |
|------------|-----------------|
| I dag | `today` |
| Denne uge | `this_week` |
| Denne måned | `this_month` |
| Lønperiode | `payroll_period` |

**KPI-slugs der hentes:**
- `sales_count` → antal salg
- `total_commission` → provision
- `total_revenue` → omsætning

### Custom perioder → Direkte query med FM-salg
For brugerdefinerede datoperioder hentes data direkte, men:
- Inkluder `fieldmarketing_sales` (via `client_id`)
- Tilføj pagination med `fetchAllRows` pattern

## Tekniske ændringer

### 1. Tilføj KPI-mapping funktion
```typescript
function mapPeriodModeToKpiPeriod(mode: PeriodMode): string | null {
  switch (mode) {
    case "day": return "today";
    case "week": return "this_week";
    case "month": return "this_month";
    case "payroll": return "payroll_period";
    default: return null; // Custom → fallback
  }
}
```

### 2. Ny query: Hent KPI-data per klient
```typescript
const { data: kpiClientData } = useQuery({
  queryKey: ["kpi-client-sales", kpiPeriodType],
  queryFn: async () => {
    const { data } = await supabase
      .from("kpi_cached_values")
      .select("scope_id, kpi_slug, value")
      .eq("scope_type", "client")
      .eq("period_type", kpiPeriodType)
      .in("kpi_slug", ["sales_count", "total_commission", "total_revenue"]);
    
    // Group by client_id
    return groupByClient(data);
  },
  enabled: !!kpiPeriodType, // Kun for standard perioder
});
```

### 3. Fallback query for custom perioder
Opdater eksisterende `salesByClient` query til at:
- Inkludere `fieldmarketing_sales` data
- Bruge pagination (`fetchAllRows` pattern)
- Kun køre når `mode === "custom"`

### 4. Merge datakilder i useMemo
```typescript
const salesByClientFinal = useMemo(() => {
  if (kpiClientData && kpiPeriodType) {
    return kpiClientData; // Fra KPI-cache
  }
  return salesByClientDirect; // Fallback til direkte query
}, [kpiClientData, salesByClientDirect, kpiPeriodType]);
```

## Fordele
- Hurtigere datahentning fra pre-computed cache
- Inkluderer fieldmarketing-salg korrekt
- Undgår 1000-rækkers begrænsningen
- Konsistente tal med andre dashboards

## Filer der ændres
| Fil | Ændring |
|-----|---------|
| `src/components/salary/ClientDBTab.tsx` | Tilføj KPI-cache query, periode-mapping, merge-logik |
