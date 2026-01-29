

# Synkroniser datalogi mellem Normal View og TV Mode

## Problemanalyse

Der er **to forskellige datakilder** for top-sælgere og salgstal:

### Normal View (browser)
- **Top sellers:** Læser fra `kpi_leaderboard_cache` tabellen via `useCachedLeaderboard` hook
- **Cache opdateres** af `calculate-kpi-values` edge function (kører på schedule, ca. hvert 30. minut)
- **Logik:** Bruger korrekt `mapped_commission` fra `sale_items` + FM sales med `fmCommissionMap`

### TV Mode (edge function)
- **Top sellers:** Beregnes **on-the-fly** i `tv-dashboard-data/index.ts`
- **15 sekunders in-memory cache** (linje 15)
- **Logik:** Tæller `mapped_commission` + FM commission fra products

### Forskelle der kan forårsage uoverensstemmelser:

| Aspekt | Normal View (Cache) | TV Mode (On-the-fly) |
|--------|---------------------|----------------------|
| **Data alder** | Op til 30 min gammel | Max 15 sek gammel |
| **FM commission** | Via `fmCommissionMap` (lookup) | Via `products.commission_dkk` |
| **Name resolution** | Fuldt opløst via employeeMap | Opløst via `resolveAgentNames()` |
| **Period** | "today" fra cache | Beregnet for dagens dato |

## Løsningsforslag

### Option A: TV mode bruger cached leaderboard (Anbefalet)

Opdatér `tv-dashboard-data/index.ts` til at læse fra `kpi_leaderboard_cache` i stedet for at beregne on-the-fly:

```typescript
// I tv-dashboard-data/index.ts - erstat topSellers beregning

// Hent cached global leaderboard for "today"
const { data: cachedLeaderboard } = await supabase
  .from("kpi_leaderboard_cache")
  .select("leaderboard_data")
  .eq("period_type", "today")
  .eq("scope_type", "global")
  .is("scope_id", null)
  .order("calculated_at", { ascending: false })
  .limit(1)
  .maybeSingle();

const topSellers = cachedLeaderboard?.leaderboard_data
  ? (cachedLeaderboard.leaderboard_data as any[]).slice(0, 20).map((entry, index) => ({
      name: formatDisplayName(entry.employeeName),
      commission: entry.commission,
      rank: index + 1,
    }))
  : [];
```

### Fordele ved Option A:
- **Ensartet data** - Begge views bruger præcis samme beregning
- **Mindre database load** - Ingen ekstra beregning i TV mode
- **Hurtigere response** - Simple table lookup i stedet for kompleks aggregation
- **Vedligeholdbar** - Kun ét sted at opdatere logikken

### Option B: Øg cache-frekvens (Alternativ)

Hvis real-time opdatering er kritisk, kan `calculate-kpi-values` køres oftere (fx hvert 5. minut) og TV mode læser stadig fra cache.

## Implementeringsplan

### 1. Opdatér tv-dashboard-data edge function

**Fil:** `supabase/functions/tv-dashboard-data/index.ts`

**Ændringer:**
- Fjern inline topSellers beregning (sellerCommission tracking, resolveAgentNames call)
- Tilføj cache lookup fra `kpi_leaderboard_cache`
- Behold FM sales aggregation for `salesByClient` (dette fungerer korrekt)

### 2. Test synkronisering

Verificer at:
- Top 20 sælgere viser identiske navne og beløb
- Salgstal per klient matcher
- "Sælgere på board" tæller er ens

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `supabase/functions/tv-dashboard-data/index.ts` | Brug cached leaderboard i stedet for on-the-fly beregning |

## Resultat

Efter implementering vil:
1. TV mode og normal view vise **identiske top-sælger data**
2. Begge views bruge **samme beregningslogik** (fra `calculate-kpi-values`)
3. Database load blive **reduceret** (færre queries i TV mode)
4. Forsinkelse være **max 30 minutter** (cache opdaterings-interval)

## Teknisk note

`kpi_leaderboard_cache` tabellen opdateres af `calculate-kpi-values` edge function. Denne kører på et cron-schedule. Aktuelle data viser at cachen opdateres ca. hvert 30. minut (seneste: 09:00, 08:30, 08:00).

Hvis strammere synkronisering ønskes, kan cron-intervallet reduceres til fx hvert 10. minut.

