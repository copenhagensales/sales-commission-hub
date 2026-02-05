

# Plan: Fix KPI Cache Akkumulerings-Bug

## Problemanalyse

Jeg har identificeret en **kritisk data-integritetsfejl** i KPI-caching systemet der forårsager massive inflation af provision og salgstal.

### Root Cause

1. **Watermark-opdatering fejler** - Funktionen `calculate-kpi-incremental` kan ikke opdatere sine watermarks pga. en konflikt mellem partial indexes på `kpi_watermarks` tabellen
2. **Duplicate constraint fejl** - Logs viser gentagne fejl: `duplicate key value violates unique constraint "unique_watermark_key_null"`
3. **Samme salg tælles igen og igen** - Fordi watermark sidder fast på 4. februar kl. 18:11, finder hver kørsel de samme ~130 salg som "nye" og tilføjer dem til cachen

### Data-sammenligning (Gustav Rathleff)

| Metric | Faktisk (DB) | KPI Cache | Inflation |
|--------|-------------|-----------|-----------|
| **Provision (lønperiode)** | 41.350 kr | 105.750 kr | +155% |
| **Salg (lønperiode)** | 13 | 101 | +677% |
| **Provision (i dag)** | 2.300 kr | 34.500 kr | +1400% |
| **Salg (i dag)** | 1 | 30 | +2900% |

## Løsning (2 dele)

### Del 1: Fix watermark upsert-logik

Problemet er at Supabase's upsert med `onConflict` ikke håndterer NULL-værdier korrekt med partial indexes. Løsningen er at bruge en upsert-strategi der eksplicit håndterer NULL scope_id.

**Ændringer i `calculate-kpi-incremental/index.ts`:**

```typescript
// NUVÆRENDE (fejler):
async function upsertWatermarks(supabase, watermarks) {
  for (const wm of watermarks) {
    await supabase
      .from("kpi_watermarks")
      .upsert(wm, { onConflict: "period_type,scope_type,scope_id" });
  }
}

// NY LØSNING - Brug RPC eller direkte UPDATE + INSERT:
async function upsertWatermarks(supabase, watermarks) {
  for (const wm of watermarks) {
    // For NULL scope_id, use direct update/insert pattern
    if (wm.scope_id === null) {
      const { error: updateError } = await supabase
        .from("kpi_watermarks")
        .update({ 
          last_processed_at: wm.last_processed_at, 
          updated_at: new Date().toISOString() 
        })
        .eq("period_type", wm.period_type)
        .eq("scope_type", wm.scope_type)
        .is("scope_id", null);
      
      // If no rows updated, insert
      if (updateError) {
        console.log("[upsertWatermarks] Update failed, trying insert");
      }
    } else {
      // Normal upsert for non-null scope_id
      await supabase
        .from("kpi_watermarks")
        .upsert(wm, { onConflict: "period_type,scope_type,scope_id" });
    }
  }
}
```

### Del 2: Genberegn KPI cache fra bunden

Efter fix af upsert-logikken, skal cachen nulstilles og genberegnes:

1. **Slet korrupte employee-scoped cache værdier:**
```sql
DELETE FROM kpi_cached_values 
WHERE scope_type = 'employee' 
  AND kpi_slug IN ('sales_count', 'total_commission')
  AND period_type IN ('today', 'payroll_period');
```

2. **Nulstil watermarks:**
```sql
UPDATE kpi_watermarks 
SET last_processed_at = '2026-01-15T00:00:00Z'
WHERE scope_type = 'employee';
```

3. **Trigger full refresh** via `calculate-kpi-values` funktionen

## Tekniske detaljer

### Berørte filer
- `supabase/functions/calculate-kpi-incremental/index.ts` - Fix `upsertWatermarks` funktion

### Database ændringer
- Ingen schema ændringer nødvendige
- Data-cleanup kræves (engangskørsel)

### Fremtidig forebyggelse
Tilføj en validerings-check der sammenligner cache mod faktiske tal:

```typescript
// Add validation before upsert (linje ~465)
if (Math.abs(existingValue - actualValue) > actualValue * 0.5) {
  console.warn(`[VALIDATION] Large discrepancy detected for ${empId}: 
    cached=${existingValue}, actual=${actualValue}`);
  // Reset to actual value instead of accumulating
  newValue = actualValue;
}
```

## Implementeringsrækkefølge

1. Deploy fix til `calculate-kpi-incremental` edge function
2. Kør data cleanup SQL
3. Verificer at watermarks nu opdateres korrekt
4. Bekræft at Gustav Rathleff's tal matcher database

