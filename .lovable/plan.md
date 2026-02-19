

# Justeret samlet optimeringsplan
*Inkorporerer alle 6 punkter fra review*

---

## Del 1: Enreach tidszone-fix (korrigeret)

### 1a. Shared helper: `enreachToUTC()` (ny fil)

Oprettes som `supabase/functions/_shared/enreach-timezone.ts` -- bruges af begge ingest-veje.

Reviewets pointe er korrekt: vi skal IKKE manuelt trække 1-2 timer fra. I stedet skal vi parse datostrengen som dansk lokaltid og lade timezone-regler haandtere DST korrekt:

```typescript
export function enreachToUTC(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();

  // Normaliser DD-MM-YYYY HH:mm:ss til ISO-format
  const heroMatch = dateStr.match(
    /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/
  );
  const isoStr = heroMatch
    ? `${heroMatch[3]}-${heroMatch[2]}-${heroMatch[1]}T${heroMatch[4]}:${heroMatch[5]}:${heroMatch[6]}`
    : dateStr;

  // Find CET/CEST offset for denne specifikke dato
  const naive = new Date(isoStr);
  if (isNaN(naive.getTime())) return new Date().toISOString();

  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Copenhagen",
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(naive);
  const offsetStr = parts.find((p) => p.type === "timeZoneName")?.value || "";
  const offsetHours = parseInt(offsetStr.replace("GMT", "") || "1", 10);

  // Trael offset fra for at konvertere DK lokal -> UTC
  return new Date(naive.getTime() - offsetHours * 3600000).toISOString();
}
```

### 1b. Integration-engine adapter (`enreach.ts` linje 725)

Importer shared helper og wrap `saleDate`:

```typescript
import { enreachToUTC } from "../_shared/enreach-timezone.ts";
// ...
const saleDate = enreachToUTC(
  this.getStr(lead, ["firstProcessedTime", "lastModifiedTime"])
);
```

### 1c. Webhook parser (`dialer-webhook/parsers/enreach.ts` linje 269-289)

Erstat `parseHeroBaseDate()` body med kald til shared helper.

### 1d. Historisk SQL-korrektion (korrigeret pr. review punkt 1)

Reviewets `AT TIME ZONE` trick er den korrekte loesning -- deterministisk og DST-safe:

```sql
-- Enreach timestamps er gemt som UTC men repraesenterer dansk lokaltid.
-- Korrekt UTC faas ved at fortolke vaerdien som Europe/Copenhagen wall-time.
UPDATE sales
SET sale_datetime = (
  (sale_datetime AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Copenhagen'
)
WHERE integration_type = 'enreach'
  AND sale_datetime IS NOT NULL;
```

Denne SQL haandterer marts/oktober-overgange korrekt fordi PostgreSQL kender DST-reglerne for `Europe/Copenhagen`.

**Verifikation foer/efter** (koeres manuelt):
```sql
SELECT id, sale_datetime as before,
  (sale_datetime AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Copenhagen' as after
FROM sales
WHERE integration_type = 'enreach'
ORDER BY sale_datetime DESC LIMIT 10;
```

---

## Del 2: Cron-job optimering

### Faktiske tal (verificeret fra `cron.job`)

Aktive per-minut jobs: 3 stk (kpi-incr, leaderboard-incr, emails)

| Job | jobid | Nu | Ny | Besparelse/time |
|-----|-------|-----|-----|----------------|
| calculate-leaderboard-incremental | 59 | `* * * * *` | `*/2 * * * *` | -30 |
| process-scheduled-emails | 44 | `* * * * *` | `*/5 * * * *` | -48 |
| calculate-kpi-values-full-refresh | 63 | `0 * * * *` | `30 * * * *` | 0 (overlap-fix) |
| calculate-leaderboard-full-refresh | 62 | `5,35 * * * *` | `30 * * * *` | -1 |
| calculate-kpi-incremental | 55 | `* * * * *` | **Behold** | 0 |

**Korrigeret netto (pr. review punkt 4):**
- Baseline per-minut: 3 jobs x 60 = 180/time
- Efter: 60 (kpi-incr) + 30 (leaderboard-incr) + 12 (emails) = 102/time
- Besparelse: **-78 kald/time** fra de 3 per-minut jobs
- Plus dialer-syncs (~50/time) og daglige jobs (~10/time) er uaendrede
- Total baseline: ~240/time, efter: ~162/time (ca. **-33%**)

Cron-opdatering koeres via `cron.unschedule` + `cron.schedule` i SQL migration.

---

## Del 3: Team Performance RPC (pr. review punkt 5 og 6)

### Datakontrakt (eksplicit matchet mod frontend linje 510-814)

RPC'en `get_team_performance_summary(p_date date)` skal implementere praecis:

1. **Filtrering**: `validation_status != 'rejected'` (linje 555)
2. **counts_as_sale**: Kun taelle items hvor `products.counts_as_sale = true` (linje 681)
3. **Agent-mapping fallback**: email -> email prefix -> agent name (linje 620-652)
4. **Stab-eksklusion**: `teams.name != 'Stab'` (linje 525)
5. **Fravaer**: Kun `approved` absences, kun `sick` og `vacation` typer (linje 743-749)
6. **Work days**: Beregnes client-side (weekend-logik forbliver i frontend, linje 714-728)
7. **Klient-split**: Per-team per-client salgstal via `team_clients` (linje 790-793)

### Sikkerhed (pr. review punkt 6)

```sql
CREATE OR REPLACE FUNCTION public.get_team_performance_summary(p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  -- Kun brugere med teamleder+ eller dashboard-adgang
BEGIN
  IF NOT (
    public.is_teamleder_or_above(auth.uid())
    OR public.is_owner(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  -- ... aggregeringslogik ...
END;
$function$
```

Key points:
- `SECURITY DEFINER` med fast `search_path TO 'public'`
- Eksplicit autorisationscheck som foerste linje
- Returnerer JSONB med praecis samme struktur som frontend forventer

### Return-struktur

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

Work days beregnes stadig client-side (linje 771-782) da SQL ikke nemt haandterer `countWorkDaysInPeriod` med locale.

---

## Del 4: Candidates query (korrigeret pr. review punkt 3)

### Problem

Nuvaerende kode (linje 198-218) beregner 4 vaerdier: `last24h`, `prev24h`, `last7d`, `prev7d` for trend-beregning. En simpel count-query giver kun 2 tal.

### Korrigeret loesning

Erstat med **4 separate count-queries** (alle `head: true`, 0 raekker):

```typescript
const now = new Date();
const [last24h, prev24h, last7d, prev7d] = await Promise.all([
  supabase.from("candidates").select("*", { count: "exact", head: true })
    .gte("created_at", subDays(now, 1).toISOString()),
  supabase.from("candidates").select("*", { count: "exact", head: true })
    .gte("created_at", subDays(now, 2).toISOString())
    .lt("created_at", subDays(now, 1).toISOString()),
  supabase.from("candidates").select("*", { count: "exact", head: true })
    .gte("created_at", subDays(now, 7).toISOString()),
  supabase.from("candidates").select("*", { count: "exact", head: true })
    .gte("created_at", subDays(now, 14).toISOString())
    .lt("created_at", subDays(now, 7).toISOString()),
]);
```

4 count-queries er stadig langt billigere end at hente 135+ raekker, og trend-beregningen bevares praecist.

---

## Del 5: staleTime-tilfoejelser

Uaendret fra original plan -- ren config, ingen risiko:

### CphSalesDashboard

| Query | Tilfoej |
|-------|---------|
| candidates | `staleTime: 30000` |
| upcomingCohortsData | `staleTime: 30000` |
| absenceData | `staleTime: 30000` |
| teamPerformanceData | `staleTime: 30000` |
| periodSalesData | `staleTime: 30000` |

### SystemStability

| Query | Nu | Ny |
|-------|-----|-----|
| integrations | `refetchInterval: 30000` | `refetchInterval: 60000, staleTime: 30000` |
| syncRuns | `refetchInterval: 30000` | `refetchInterval: 60000, staleTime: 30000` |
| recentLogs | `refetchInterval: 30000` | `refetchInterval: 60000, staleTime: 30000` |

---

## Implementeringsraekkfoelge (justeret pr. review)

```text
Trin 1: Enreach parsing fix (adapter + webhook)
  - Opret _shared/enreach-timezone.ts
  - Opdater enreach.ts adapter (linje 725)
  - Opdater enreach.ts webhook parser (parseHeroBaseDate)

Trin 2: Verificer nye Enreach-salg i 24-48 timer
  - Koer stikproeve-query paa nye salg
  - Bekraeft at sale_datetime nu er korrekt UTC

Trin 3: Historisk migration (batch med rollback-plan)
  - Koer AT TIME ZONE SQL paa eksisterende data
  - Verificer stikproever omkring DST-overgange

Trin 4: Frontend staleTime + candidates count
  - Tilfoej staleTime til alle queries
  - Erstat candidates med 4 count-queries
  - SystemStability refetchInterval -> 60s

Trin 5: Team Performance RPC + frontend swap
  - Opret RPC med fuld datakontrakt
  - Side-by-side validering (gammel vs ny i en kort periode)
  - Swap frontend til RPC-kald

Trin 6: Cron-tuning
  - Opdater schedules via SQL
  - Monitorer freshness/SLO'er i 24 timer
```

---

## Acceptkriterier (fra review)

1. Enreach timestamps matcher source-system (+-0 min) paa stikproeve over baade CET og CEST datoer
2. CphSales dashboard giver identiske teamtal foer/efter RPC for samme dato
3. Query-volumen pr. bruger er reduceret uden KPI-drift
4. Ingen missed SLA paa incremental KPI opdatering
5. Cron-overlap ved hel time er elimineret

---

## Filer der aendres/oprettes

| Fil | Type | Aendring |
|-----|------|---------|
| `supabase/functions/_shared/enreach-timezone.ts` | NY | Shared timezone helper |
| `supabase/functions/integration-engine/adapters/enreach.ts` | AENDRE | Import + brug enreachToUTC (linje 725) |
| `supabase/functions/dialer-webhook/parsers/enreach.ts` | AENDRE | Brug enreachToUTC i parseHeroBaseDate |
| SQL migration | NY | Historisk fix + RPC + cron-opdateringer |
| `src/pages/dashboards/CphSalesDashboard.tsx` | AENDRE | RPC, count-queries, staleTime |
| `src/pages/SystemStability.tsx` | AENDRE | refetchInterval + staleTime |

## Filer der IKKE roeres

- Adversus adapter/webhook
- API sync schedules (dialer-*)
- integration-engine/index.ts
- KPI/leaderboard edge functions
- Rate limiters

---

## Forventet effekt (korrigeret tal)

| Metrik | Foer | Efter |
|--------|------|-------|
| Edge function kald/time (cron) | ~240 | ~162 (-33%) |
| DB-kald/min per CphSales-bruger | ~24 | ~8 |
| Raekker/min per CphSales-bruger | ~13.000 | ~500 |
| SystemStability DB-kald/min | ~8 | ~4 |
| Enreach timestamp-fejl | +1-2 timer | Korrekt UTC |
| Kandidat-raekker hentet/min | 135+ | 0 (count only) |

