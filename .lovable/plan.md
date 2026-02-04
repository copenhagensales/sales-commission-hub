

# Komplet Systemoptimering: Data-kvalitet, Skalering & Arkitektur

## Overblik

Denne plan samler **alle identificerede problemer og løsninger** fra vores gennemgang af systemet. Planen inkluderer data-oprydning, forebyggelse af fremtidige problemer, paginering, central arkitektur og automatisk vedligeholdelse.

---

## Gyldige Email-domæner (Whitelist)

| Domæne | Antal medarbejdere | Status |
|--------|-------------------|--------|
| `@copenhagensales.dk` | 90 | Primær |
| `@cph-relatel.dk` | 10 | Gyldig |
| `@cph-sales.dk` | 1 | Gyldig |

### Emails der IKKE skal gemmes:
- `agent-*@adversus.local` - Pseudo-emails (~9.137 salg)
- Tom/manglende email - Enreach-data (~12.173 salg)
- Partner-domæner: `@relatel.dk`, `@ps-marketing.dk`, `@finansforbundet.dk`, etc.
- Private emails: `@gmail.com`, `@hotmail.com`, etc.
- Klient-emails: `@nuuday.dk`, `@tryg.dk`, etc.

---

## FASE 1: Data-oprydning (SQL Migration)

### 1.1 Slet salg med pseudo-emails

```sql
DELETE FROM sale_items
WHERE sale_id IN (
  SELECT id FROM sales 
  WHERE agent_email LIKE 'agent-%@adversus.local'
);

DELETE FROM sales
WHERE agent_email LIKE 'agent-%@adversus.local';

DELETE FROM agents
WHERE email LIKE 'agent-%@adversus.local';
```

### 1.2 Slet Enreach-salg uden agent_email

```sql
DELETE FROM sale_items
WHERE sale_id IN (
  SELECT id FROM sales 
  WHERE (agent_email IS NULL OR agent_email = '')
    AND integration_type = 'enreach'
);

DELETE FROM sales
WHERE (agent_email IS NULL OR agent_email = '')
  AND integration_type = 'enreach';
```

---

## FASE 2: Fix Cache-arkitektur (SQL Migration)

### 2.1 Fix UNIQUE constraints med NULLS NOT DISTINCT

```sql
ALTER TABLE kpi_leaderboard_cache 
  DROP CONSTRAINT kpi_leaderboard_cache_period_type_scope_type_scope_id_key;
ALTER TABLE kpi_leaderboard_cache 
  ADD CONSTRAINT kpi_leaderboard_cache_unique 
  UNIQUE NULLS NOT DISTINCT (period_type, scope_type, scope_id);

ALTER TABLE kpi_cached_values 
  DROP CONSTRAINT kpi_cached_values_kpi_slug_period_type_scope_type_scope_id_key;
ALTER TABLE kpi_cached_values 
  ADD CONSTRAINT kpi_cached_values_unique 
  UNIQUE NULLS NOT DISTINCT (kpi_slug, period_type, scope_type, scope_id);
```

### 2.2 Ryd eksisterende duplikater

```sql
DELETE FROM kpi_leaderboard_cache a
USING kpi_leaderboard_cache b
WHERE a.id < b.id
  AND a.period_type = b.period_type
  AND a.scope_type = b.scope_type
  AND COALESCE(a.scope_id::text, '') = COALESCE(b.scope_id::text, '');

DELETE FROM kpi_cached_values a
USING kpi_cached_values b
WHERE a.id < b.id
  AND a.kpi_slug = b.kpi_slug
  AND a.period_type = b.period_type
  AND a.scope_type = b.scope_type
  AND COALESCE(a.scope_id::text, '') = COALESCE(b.scope_id::text, '');
```

### 2.3 Opret RPC-funktion til server-side aggregering

```sql
CREATE OR REPLACE FUNCTION get_sales_aggregates(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_team_id UUID DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_sales INTEGER,
  total_commission DECIMAL,
  total_revenue DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(si.quantity), 0)::INTEGER,
    COALESCE(SUM(si.mapped_commission * si.quantity), 0),
    COALESCE(SUM(si.mapped_revenue * si.quantity), 0)
  FROM sale_items si
  JOIN sales s ON si.sale_id = s.id
  LEFT JOIN client_campaigns cc ON s.client_campaign_id = cc.id
  LEFT JOIN employee_agent_mapping eam ON (
    s.agent_email = (SELECT email FROM agents WHERE id = eam.agent_id)
  )
  LEFT JOIN team_members tm ON eam.employee_id = tm.employee_id
  WHERE s.sale_datetime BETWEEN p_start AND p_end
    AND (p_team_id IS NULL OR tm.team_id = p_team_id)
    AND (p_employee_id IS NULL OR eam.employee_id = p_employee_id)
    AND (p_client_id IS NULL OR cc.client_id = p_client_id)
    AND COALESCE(s.validation_status, 'approved') NOT IN ('cancelled', 'rejected');
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## FASE 3: Forebyg Ugyldige Data ved Sync (Edge Functions)

### 3.1 Opdater `src/lib/excluded-domains.ts`

Tilføj whitelist og pseudo-email pattern:

```typescript
export const VALID_EMAIL_DOMAINS = [
  "@copenhagensales.dk",
  "@cph-relatel.dk", 
  "@cph-sales.dk",
];

export const EXCLUDED_EMAIL_PATTERNS = [
  /^agent-\d+@adversus\.local$/i,
];

export function isValidSyncEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const emailLower = email.toLowerCase();
  
  if (EXCLUDED_EMAIL_PATTERNS.some(pattern => pattern.test(emailLower))) {
    return false;
  }
  
  return VALID_EMAIL_DOMAINS.some(domain => emailLower.endsWith(domain));
}
```

### 3.2 Opdater `supabase/functions/integration-engine/core/users.ts`

Tilføj whitelist-validering og brug `isValidSyncEmail()`:

```typescript
const VALID_EMAIL_DOMAINS = [
  "@copenhagensales.dk",
  "@cph-relatel.dk",
  "@cph-sales.dk",
];

const EXCLUDED_EMAIL_PATTERNS = [
  /^agent-\d+@adversus\.local$/i,
];

function isValidSyncEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const emailLower = email.toLowerCase();
  
  if (EXCLUDED_EMAIL_PATTERNS.some(pattern => pattern.test(emailLower))) {
    return false;
  }
  
  return VALID_EMAIL_DOMAINS.some(domain => emailLower.endsWith(domain));
}

// I processUsers() - ændr if-check:
if (!isValidSyncEmail(user.email)) {
  log("INFO", `Skipping user with invalid email: ${user.email}`);
  skipped++;
  continue;
}
```

### 3.3 Opdater `supabase/functions/integration-engine/core/sales.ts`

Tilføj filtrering af salg uden gyldig agent-email:

```typescript
// Tilføj samme VALID_EMAIL_DOMAINS, EXCLUDED_EMAIL_PATTERNS, isValidSyncEmail()

// I processSales() - efter deduplicering:
const validSales = Array.from(byExternalId.values()).filter(sale => {
  if (!isValidSyncEmail(sale.agentEmail)) {
    log("INFO", `Skipping sale ${sale.externalId} - invalid agent email: ${sale.agentEmail}`);
    return false;
  }
  return true;
});
```

### 3.4 Opdater `supabase/functions/integration-engine/adapters/adversus.ts`

Skip brugere uden rigtig email:

```typescript
async fetchUsers(): Promise<StandardUser[]> {
  const data = await this.get("/users");
  const users = data.users || data || [];

  return users
    .filter((u: any) => {
      if (!u.email || u.email.trim() === '') {
        console.log(`[Adversus] Skipping user ${u.id} - no email`);
        return false;
      }
      return true;
    })
    .map((u: any) => ({
      externalId: String(u.id),
      name: u.name || u.displayName,
      email: u.email,
      isActive: u.active,
    }));
}
```

### 3.5 Opdater `supabase/functions/integration-engine/adapters/enreach.ts`

Skip brugere og salg uden gyldig email.

---

## FASE 4: Frontend Paginering

Erstat direkte Supabase queries med `fetchAllRows`:

### Kritiske lønkomponenter:

| Fil | Ændring |
|-----|---------|
| `src/components/salary/DBOverviewTab.tsx` | Erstat sale_items query med `fetchAllRows` |
| `src/components/salary/CombinedSalaryTab.tsx` | Erstat sale_items query med `fetchAllRows` |
| `src/components/salary/DBDailyBreakdown.tsx` | Erstat sale_items query med `fetchAllRows` |

### Dashboard-hooks:

| Fil | Ændring |
|-----|---------|
| `src/hooks/useCelebrationData.ts` | Erstat 3 parallelle queries med `fetchAllRows` |
| `src/hooks/useRecognitionKpis.ts` | Erstat sale_items query med `fetchAllRows` |
| `src/hooks/usePreviousPeriodComparison.ts` | Erstat sales query med `fetchAllRows` |

### Medarbejder- og dashboard-komponenter:

| Fil | Ændring |
|-----|---------|
| `src/components/employee/EmployeeCommissionHistory.tsx` | Tilføj paginering |
| `src/components/my-profile/SalesGoalTracker.tsx` | Tilføj paginering |
| `src/components/home/HeadToHeadComparison.tsx` | Tilføj paginering |

---

## FASE 5: Edge Function Paginering

### 5.1 Opdater `supabase/functions/tv-dashboard-data/index.ts`

Opret helper-funktion til pagineret fetch og anvend den konsistent på alle steder der henter salgsdata.

---

## FASE 6: Central Aggregerings-hook

### 6.1 Opret ny fil: `src/hooks/useSalesAggregates.ts`

```typescript
interface SalesAggregates {
  totalSales: number;
  totalCommission: number;
  totalRevenue: number;
  byEmployee: Record<string, { sales: number; commission: number; revenue: number }>;
  byDate: Record<string, { sales: number; commission: number; revenue: number }>;
  byTeam: Record<string, { sales: number; commission: number; revenue: number }>;
  isFromCache: boolean;
}

export function useSalesAggregates(params: {
  periodStart: Date;
  periodEnd: Date;
  teamId?: string;
  employeeId?: string;
  clientId?: string;
  enabled?: boolean;
}) {
  // 1. Prøv RPC først (server-side aggregering)
  // 2. Fallback til pagineret fetchAllRows
}
```

---

## FASE 7: Automatisk Vedligeholdelse

### 7.1 Opret cleanup-funktioner og cron jobs

```sql
-- Leaderboard cache cleanup
CREATE OR REPLACE FUNCTION cleanup_stale_leaderboard_cache()
RETURNS integer AS $$
DECLARE v_deleted INTEGER;
BEGIN
  DELETE FROM kpi_leaderboard_cache
  WHERE calculated_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule(
  'cleanup-leaderboard-cache',
  '0 3 * * *',
  $$SELECT cleanup_stale_leaderboard_cache()$$
);
```

---

## Implementeringsrækkefølge (Opdateret)

| # | Opgave | Type | Prioritet | Estimat |
|---|--------|------|-----------|---------|
| 1 | Slet salg med pseudo-emails | SQL Migration | Kritisk | 10 min |
| 2 | Slet Enreach-salg uden email | SQL Migration | Kritisk | 10 min |
| 3 | Fix UNIQUE constraints | SQL Migration | Kritisk | 15 min |
| 4 | Ryd cache-duplikater | SQL Migration | Kritisk | 10 min |
| 5 | Opret RPC `get_sales_aggregates` | SQL Migration | Høj | 20 min |
| 6 | Opdater `excluded-domains.ts` med whitelist | Frontend | Høj | 15 min |
| 7 | Opdater `users.ts` med whitelist + patterns | Edge Function | Høj | 20 min |
| 8 | Opdater `sales.ts` med email-filtrering | Edge Function | Høj | 20 min |
| 9 | Opdater `adversus.ts` - skip brugere uden email | Edge Function | Høj | 15 min |
| 10 | Opdater `enreach.ts` - skip data uden email | Edge Function | Høj | 15 min |
| 11 | Opret `useSalesAggregates.ts` | Ny fil | Høj | 30 min |
| 12 | Paginering: DBOverviewTab | Frontend | Høj | 25 min |
| 13 | Paginering: CombinedSalaryTab | Frontend | Høj | 20 min |
| 14 | Paginering: DBDailyBreakdown | Frontend | Høj | 20 min |
| 15 | Paginering: useCelebrationData | Frontend | Høj | 20 min |
| 16 | Paginering: useRecognitionKpis | Frontend | Medium | 15 min |
| 17 | Paginering: usePreviousPeriodComparison | Frontend | Medium | 15 min |
| 18 | Paginering: EmployeeCommissionHistory | Frontend | Medium | 20 min |
| 19 | Paginering: SalesGoalTracker (NY!) | Frontend | Medium | 15 min |
| 20 | Paginering: HeadToHeadComparison (NY!) | Frontend | Medium | 20 min |
| 21 | Paginering: tv-dashboard-data (NY!) | Edge Function | Høj | 45 min |
| 22 | Opret cleanup cron | SQL Migration | Lav | 15 min |

**Total estimat:** ~7-8 timer

---

## Filer der oprettes/ændres

### Nye filer:
1. `src/hooks/useSalesAggregates.ts` - Central aggregerings-hook

### Frontend (11 filer):
2. `src/lib/excluded-domains.ts` - Whitelist + patterns
3. `src/components/salary/DBOverviewTab.tsx`
4. `src/components/salary/CombinedSalaryTab.tsx`
5. `src/components/salary/DBDailyBreakdown.tsx`
6. `src/components/employee/EmployeeCommissionHistory.tsx`
7. `src/components/my-profile/SalesGoalTracker.tsx`
8. `src/components/home/HeadToHeadComparison.tsx`
9. `src/hooks/useCelebrationData.ts`
10. `src/hooks/useRecognitionKpis.ts`
11. `src/hooks/usePreviousPeriodComparison.ts`

### Edge Functions (5 filer):
12. `supabase/functions/integration-engine/core/users.ts`
13. `supabase/functions/integration-engine/core/sales.ts`
14. `supabase/functions/integration-engine/adapters/adversus.ts`
15. `supabase/functions/integration-engine/adapters/enreach.ts`
16. `supabase/functions/tv-dashboard-data/index.ts`

### Database (SQL migrations):
17. Slet pseudo-email salg + sale_items
18. Slet Enreach salg uden email
19. Fix UNIQUE constraints (NULLS NOT DISTINCT)
20. Ryd duplikater
21. Opret RPC `get_sales_aggregates`
22. Opret cleanup funktion + cron

---

## Forventet Resultat

| Metrik | Før | Efter |
|--------|-----|-------|
| Antal salg i database | ~35.000 | ~14.000 (kun valide) |
| Data-kvalitet | ~40% brugbar | 100% brugbar |
| kpi_leaderboard_cache | 144 MB (55.000 rækker) | <1 MB (~36 rækker) |
| kpi_cached_values | 272 MB (18.000 rækker) | <5 MB (~1.200 rækker) |
| Lønberegning nøjagtighed | Variabel (maks 1000 salg) | 100% (alle salg) |
| Antal separate beregningslogikker | 8+ | 1 (central hook) |
| Konsistens mellem visninger | Ingen garanti | 100% (samme kilde) |
| Fremtidig sync | Gemmer ugyldigt data | Kun gyldige emails synces |

---

## Teknisk Arkitektur (Før vs. Efter)

```text
FØR:
  Adversus/Enreach --> Gemmer ALT (inkl. ugyldigt)
  |
  v
  sales (35.000) --> 60% ubrugelig data
  |
  v
  8+ komponenter med egen beregning --> Inkonsistente tal
  |
  v
  Rammer 1000-graense --> Forkerte tal
  |
  v
  Cache-tabeller --> Duplikerer ved NULL --> 250+ MB spild

EFTER:
  Adversus/Enreach --> Filtrerer ugyldigt VED SYNC (whitelist)
  |
  v
  sales (14.000) --> 100% valid data (kun @copenhagensales.dk etc)
  |
  v
  useSalesAggregates (central hook) --> En kilde til sandhed
  |
  v
  fetchAllRows / RPC --> Pagineret --> Komplet data
  |
  v
  Cache-tabeller --> NULLS NOT DISTINCT --> Korrekt upsert
  |
  v
  Cleanup cron --> Automatisk vedligeholdelse
```

---

## Denne plan inkluderer:

1. **Data-oprydning** - Slet ugyldige salg (pseudo-emails + Enreach uden email)
2. **Cache-fix** - UNIQUE NULLS NOT DISTINCT + ryd duplikater
3. **Forebyggelse med Whitelist** - Kun `@copenhagensales.dk`, `@cph-relatel.dk`, `@cph-sales.dk` gemmes
4. **Paginering i Frontend** - Alle kritiske komponenter (inkl. SalesGoalTracker, HeadToHeadComparison)
5. **Paginering i Edge Functions** - tv-dashboard-data
6. **Central hook** - `useSalesAggregates.ts` som én kilde til sandhed
7. **Server-side aggregering** - RPC `get_sales_aggregates` funktion
8. **Automatisk cleanup** - Daglig cron for leaderboard cache

