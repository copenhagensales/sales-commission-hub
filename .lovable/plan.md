

# Plan: Historisk KPI-cache og ensretning af datakilder

## Baggrund

I dag beregner `calculate-kpi-incremental` kun rullende perioder (`today`, `this_week`, `payroll_period`) og overskriver dem hvert minut via UPSERT. Naar en loenperiode slutter, forsvinder dens data. Det betyder at historiske perioder krsver direkte queries mod `sales`-tabellen, hvilket skaber risiko for afvigende tal og performance-problemer.

## Maal

1. KPI-cachen gemmer afsluttede loenperioder permanent
2. Saelgerloensninger bruger KPI-cache i stedet for direkte sales-queries
3. Andre steder i systemet der henter direkte fra sales identificeres og planlaegges

---

## Del 1: Database - Historisk lagring

### Ny tabel: `kpi_period_snapshots`

En dedikeret tabel til afsluttede perioder (adskilt fra den rullende cache for at undgaa konflikter med det eksisterende UPSERT-moenster):

```text
kpi_period_snapshots
  id              uuid (PK)
  kpi_slug        text
  period_key      text        -- fx "payroll_2026-01-15"
  period_start    date
  period_end      date
  scope_type      text        -- global, client, employee
  scope_id        uuid
  value           numeric
  formatted_value text
  snapshotted_at  timestamptz
  
  UNIQUE(kpi_slug, period_key, scope_type, scope_id)
```

Alternativt kan vi genbruge `kpi_cached_values` med en `period_type` som `payroll_2026-01-15` i stedet for `payroll_period`. Det er simplere men blander rullende og historisk data. **Anbefaling: ny tabel** for renere adskillelse.

### Indexes

- `(period_key, scope_type, scope_id)` - opslag per periode
- `(kpi_slug, scope_type, scope_id, period_start)` - tidsserieforespoegsler

---

## Del 2: Edge function - Snapshot ved periodeslukning

### Ny edge function: `snapshot-payroll-period`

- Koeres via cron den 15. i hver maaned (eller manuelt)
- Beregner den netop afsluttede loenperiode (fx 15. jan - 14. feb)
- Gemmer alle KPI-vaerdier (sales_count, total_commission per employee, client, global) i `kpi_period_snapshots`
- Bruger praecis samme beregningslogik som `calculate-kpi-incremental` (delt via `_shared/` helpers)

### Aendring i `calculate-kpi-incremental`

- Ingen aendring i den rullende beregning
- Eventuelt: naar perioden skifter (dag 15), trigges snapshot automatisk for forrige periode

---

## Del 3: Frontend - Saelgerloensninger bruger KPI-cache

### Fil: `src/hooks/useSellerSalariesCached.ts`

**Erstat direkte sales-query med KPI-opslag:**

```text
Er valgt periode == aktuel loenperiode?
  JA  -> kpi_cached_values (period_type = "payroll_period", scope_type = "employee")
  NEJ -> kpi_period_snapshots (period_key = "payroll_YYYY-MM-DD")
```

- Fjern Query 3 (sales + sale_items) og Query 2 (agent_mappings)
- Tilfoej en query mod `kpi_cached_values` ELLER `kpi_period_snapshots` afhaengigt af periode
- Commission per medarbejder hentes direkte som `value` fra cachen
- **Fix NULL-status problemet forsvinder** da cachen allerede haandterer dette korrekt i edge function

### Fil: `src/components/salary/SellerSalariesTab.tsx`

- Ingen aendringer (bruger allerede data fra hook'en)

---

## Del 4: Andre direkte sales-queries i systemet

Disse steder henter i dag direkte fra `sales`-tabellen og boer paa sigt migreres:

| Fil | Brug | Prioritet |
|-----|------|-----------|
| `src/hooks/useSellerSalariesCached.ts` | Provision per saelger | **Hoej** (denne plan) |
| `src/components/employee/EmployeeCommissionHistory.ts` | Dag-for-dag kommission | Medium (kraever daglig granularitet) |
| `src/components/my-profile/PayrollDayByDay.tsx` | Daglig provision i Min Profil | Medium (kraever daglig granularitet) |
| `src/pages/MyProfile.tsx` | FM-salg paa profil | Medium |
| `src/hooks/useRecognitionKpis.ts` | Anerkendelse KPI'er | Lav |
| `src/hooks/useSalesAggregates.ts` | Salgsaggregater (har RPC fallback) | Lav (allerede optimeret) |
| `src/hooks/useSalesAggregatesExtended.ts` | Udvidede aggregater | Lav (allerede optimeret) |

**Bemae rk**: `EmployeeCommissionHistory` og `PayrollDayByDay` kraever daglig granularitet som KPI-cachen ikke har. Disse kan enten:
- Forblive med direkte queries (acceptabelt da de viser detaljeret data)
- Faa en separat `kpi_daily_snapshots` tabel (fremtidig optimering)

---

## Del 5: Implementeringsraekkefoelge

1. Opret `kpi_period_snapshots` tabel med indexes og RLS
2. Opret `snapshot-payroll-period` edge function
3. Koer snapshot for alle historiske perioder (backfill)
4. Opdater `useSellerSalariesCached` til hybrid KPI-cache/snapshot
5. Opsaet cron job til automatisk snapshot den 15. hver maaned
6. (Fremtid) Migrer andre direkte queries efter behov

## Filaendringer

| Fil | Aendring |
|-----|---------|
| Migration SQL | Opret `kpi_period_snapshots` tabel |
| `supabase/functions/snapshot-payroll-period/index.ts` | Ny edge function |
| `src/hooks/useSellerSalariesCached.ts` | Brug KPI-cache/snapshots i stedet for direkte queries |

