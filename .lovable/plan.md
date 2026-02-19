

# Konsolideringsplan v5 -- Endelig Implementeringsplan

Alle rettelser fra begge fejlreviews er indarbejdet. Planen er klar til eksekvering.

---

## Verificeret Data-Status (19. feb 2026)

| Fakta | Vaerdi |
|-------|--------|
| FM salg UDEN sale_items | ~393 (vokser ~95/dag) |
| FM salg MED sale_items (product_id = NULL) | 3.383 |
| Umatched FM produktnavne | 0 (100% match) |
| "5G Internet" duplikat i products | 2 entries, samme priser (300/650 DKK) |
| FM agent_email mangler | ~110 (ingen tomme strings) |
| product_campaign_overrides (gammel, brugt af league) | 154 raekker |
| product_pricing_rules (korrekt kilde) | 285 aktive regler |
| pg_net extension | Aktiveret |
| sale_items FK til sales | ON DELETE CASCADE |
| Eksisterende triggers paa sales | Ingen |
| TM sale_items relation | 1:N (flere items per salg) |

---

## Fase 1: Database Foundation (HARD GATE -- skal vaere 100% foer Fase 5)

### Step 1.1: BEFORE INSERT trigger -- enrich_fm_sale()

Postgres-funktion paa `BEFORE INSERT ON sales`:

- Kun naar `NEW.source = 'fieldmarketing'`
- **agent_email/agent_name berigelse:**
  - Guard: `NEW.agent_email IS NULL OR btrim(NEW.agent_email) = ''`
  - Slaa `NEW.raw_payload->>'fm_seller_id'` op i `employee_master_data`
  - Saet `NEW.agent_email` og `NEW.agent_name` direkte paa NEW (ingen UPDATE)
- **client_campaign_id berigelse:**
  - Guard: `NEW.client_campaign_id IS NULL`
  - Slaa `NEW.raw_payload->>'fm_client_id'` op -- find matching `client_campaigns` via client_id
  - Saet `NEW.client_campaign_id` direkte paa NEW
- Returnerer modificeret NEW (BEFORE trigger in-place)

### Step 1.2: AFTER INSERT trigger -- create_fm_sale_items()

Postgres-funktion paa `AFTER INSERT ON sales`:

- Kun naar `NEW.source = 'fieldmarketing'`
- **Idempotens-guard:** `NOT EXISTS (SELECT 1 FROM sale_items WHERE sale_id = NEW.id)`
- Match `NEW.raw_payload->>'fm_product_name'` mod `products`:
  - Normalisering: `LOWER(TRIM(...))`
  - Filter: `WHERE is_active = true`
  - Sortering: `ORDER BY priority DESC, created_at DESC, id DESC LIMIT 1`
- **Hvis produkt IKKE findes:**
  - Log warning til `integration_logs` (provider='fieldmarketing', status='warning')
  - **Opret IKKE sale_items** (undgaa KPI-forurening)
  - RETURN (stop)
- **Hvis produkt findes:**
  - Find prisregel fra `product_pricing_rules`:
    - `WHERE product_id = matched_product.id AND is_active = true`
    - `ORDER BY priority DESC, created_at DESC, id DESC LIMIT 1`
  - Fallback til `products.commission_dkk` / `revenue_dkk` hvis ingen regel
  - `INSERT INTO sale_items (...) ... ON CONFLICT DO NOTHING`
  - Felter: `sale_id`, `product_id`, `mapped_commission`, `mapped_revenue`, `display_name`, `adversus_product_title`, `quantity=1`

### Step 1.3: FK/CASCADE assertion i migration

Tilfoej en `DO $$ ... END $$` blok der verificerer at `sale_items.sale_id` FK har `ON DELETE CASCADE`. Fejler tydeligt hvis ikke.

### Step 1.4: Backfill ~393 manglende sale_items

Idempotent migration:

- Brug `raw_payload->>'fm_product_name'` som primaer kilde
- Normalisering med `LOWER(TRIM(...))`
- `NOT EXISTS`-guard paa `sale_id`
- `INSERT ... ON CONFLICT DO NOTHING`
- **Spring over** salg med umatched produktnavn (log til `integration_logs`)
- Deterministisk produkt-match: `ORDER BY priority DESC, created_at DESC, id DESC LIMIT 1`

**Verificering (relativ):**
```text
SELECT COUNT(*) FROM sales
WHERE source = 'fieldmarketing'
  AND NOT EXISTS (SELECT 1 FROM sale_items WHERE sale_id = sales.id)
  AND EXISTS (SELECT 1 FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM(sales.raw_payload->>'fm_product_name')));
-- Forventet: 0
```

### Step 1.5: Backfill product_id paa 3.383 eksisterende items

Match via `sales.raw_payload->>'fm_product_name'` (LOWER/TRIM) mod `products`. Samme deterministiske sortering.

**Verificering:**
```text
SELECT COUNT(*) FROM sale_items si
JOIN sales s ON s.id = si.sale_id
WHERE s.source = 'fieldmarketing' AND si.product_id IS NULL;
-- Forventet: 0 (eller taet paa, hvis enkelte har ukendt produktnavn)
```

### Step 1.6: Berig agent_email paa ~110 FM salg

Guard: `agent_email IS NULL OR btrim(agent_email) = ''`
Kilde: `raw_payload->>'fm_seller_id'` -> `employee_master_data.work_email`

### Step 1.7: pg_net prisregel-rematch trigger

Naar `product_pricing_rules` aendres (INSERT/UPDATE/DELETE), kald `rematch-pricing-rules` via `pg_net`.
- Fail-open: log fejl til `integration_logs` med severity + korrelations-id
- Alert ved gentagne fejl (observerbart i System Stability)

### Step 1.8: HARD GATE verificering

Foelgende SKAL vaere opfyldt foer Fase 5 startes:

| Kriterie | Maaling |
|----------|---------|
| FM sales without items (med gyldigt produkt) | = 0 |
| FM sale_items with NULL product_id | = 0 |
| Trigger verificeret via 2+ insert-stier | UI + direkte INSERT |
| KPI parity (sales_count, commission_sum, revenue_sum) | Inden for 1% pr. dashboard pr. dag |

---

## Fase 2: Shared Utilities

### Step 2.1: src/utils/payrollPeriod.ts

Samler `calculatePayrollPeriod()` fra 4 identiske kopier:
- EesyTmDashboard.tsx
- TdcErhvervDashboard.tsx
- RelatelDashboard.tsx
- UnitedDashboard.tsx

### Step 2.2: src/utils/formatting.ts

Samler `getDisplayName()` og `getInitials()` fra de 4 dashboard-filer.

### Step 2.3: src/hooks/useEmployeeAvatars.ts

Erstatter identisk avatar-query i 4 filer. Samme queryKey og staleTime.

---

## Fase 3: Generisk ClientDashboard

### Step 3.1: Opret src/components/dashboard/ClientDashboard.tsx

Generisk komponent med konfiguration:

```text
interface ClientDashboardConfig {
  slug: string;
  clientId: string;
  title: string;
  features?: {
    salesPerHour?: boolean;    // Eesy, TDC
    crossSales?: boolean;      // Relatel
    liveMode?: boolean;        // Relatel
    clientBreakdown?: boolean; // United
  };
  scopeType?: "client" | "team"; // default: "client"
}
```

Bruger TvKpiCard + TvLeaderboardTable (praecis som nu).

### Step 3.2: Migrer EesyTm (~176 -> ~15 linjer)
### Step 3.3: Migrer TDC (~179 -> ~15 linjer)
### Step 3.4: Migrer Relatel (~289 -> ~20 linjer)
### Step 3.5: Migrer United (~414 -> ~25 linjer)

**Verificering per dashboard:**
- Side-by-side KPI-sammenligning (sales_count, commission_sum, revenue_sum)
- Leaderboard viser samme saelgere i samme raekkefoelge
- TV-mode virker via `/tv/:slug`
- Rettigheder uaendrede (useRequireDashboardAccess)

**Rollback:** Git revert af commits i denne fase.

---

## Fase 4: DashboardShell

### Step 4.1: Opret src/components/dashboard/DashboardShell.tsx

```text
mode: "dashboard" -> sidebar, header, auth, padding
mode: "tv"        -> fullscreen, scaling, auto-reload, ingen auth
```

### Step 4.2: Migrer dashboard-ruter til DashboardShell
### Step 4.3: Migrer TvBoardView (118 linjer -> DashboardShell mode=tv)
### Step 4.4: Forenkl TvBoardDirect (behold config-resolver, flyt TV-features)

**Verificering:**
- Auth-redirect for uautoriserede brugere
- Sidebar/header korrekt i dashboard mode
- Cursor skjult, auto-refresh i TV mode
- Auto-rotation, celebrations, keyboard nav fungerer
- Mobil layout: sidebar-sheet virker

**Rollback:** Feature flag `USE_DASHBOARD_SHELL` -- kan slaaes fra.

---

## Fase 5: Edge Function Cleanup (KUN EFTER HARD GATE)

### Step 5.1: calculate-kpi-incremental

- Slet `fetchAllFmSales()` (~30 linjer)
- Slet `fetchFmCommissionMap()` (~32 linjer)
- Fjern `.neq("source", "fieldmarketing")` fra `fetchAllSalesWithItems()`
- FM laeses nu via sale_items praecis som TM

### Step 5.2: calculate-leaderboard-incremental

- Slet FM-specifik fetch og commission map
- Fjern source-filter

### Step 5.3: league-calculate-standings

- Fjern `product_campaign_overrides` reference (154 foraldede raekker)
- Brug `sale_items.mapped_commission` direkte
- Fjern separat FM fetch
- **Bug fix:** FM liga-provisioner bliver nu korrekte

### Step 5.4: tv-dashboard-data (~1.200 linjer fjernet)

Fjern: `handleEesyTmData`, `handleTdcErhvervData`, `handleRelatelData`, `handleCsTop20Data`
Behold: `handleSalesOverviewAll` + `handleCelebrationData`

### Step 5.5: Slet fmPricing.ts + opdater imports

- `useFieldmarketingSales.ts` -- fjern `buildFmPricingMap()` (trigger haandterer det)
- `EditSalesRegistrations.tsx` -- fjern pricing-opslag
- `src/lib/calculations/index.ts` -- fjern re-export

### Step 5.6: Fjern FM_CLIENT_CAMPAIGN_MAP

Autoritativ kilde: BEFORE trigger saetter `sales.client_campaign_id` via `raw_payload->>'fm_client_id'`.

**Regression-test:** Opret FM salg for Eesy FM og YouSee, verificer mapping.

**Verificering per edge function:**
- Kald foer og efter, sammenlign output
- FM saelgere synlige i leaderboard med korrekte tal
- League provisioner valideret mod stikproeve

**Rollback:** Redeploy tidligere version af edge functions.

---

## Fase 6: Observability

### Step 6.1: RPC FM-inkludering test

Verificer `get_sales_aggregates_v2` inkluderer FM efter backfill.

### Step 6.2: Health checks i System Stability

| Check | Treshold |
|-------|----------|
| Salg uden sale_items (alle sources, med gyldigt produkt) | Warning > 0 |
| Trigger success rate (FM salg vs FM items, 24t) | Warning < 99% |
| Umatched produktnavne | Warning > 0 |
| pg_net fejl (24t) | Warning > 3 |

### Step 6.3: Post-deploy monitoring dashboard

24t trend for: FM sales inserted, FM sale_items inserted, unmatched products, trigger errors.

Stop-kriterium: hvis unmatched rate > 5% stoppes videre cleanup automatisk.

---

## End-to-end Acceptance Criteria

| Test | Forventet |
|------|-----------|
| FM salg oprettelse via UI | sale_items oprettet automatisk med korrekt provision |
| FM salg via direkte INSERT | sale_items oprettet automatisk (trigger) |
| FM salg med ukendt produkt | INGEN sale_items, warning i integration_logs |
| Dashboard KPIs (alle 4) | Inden for 1% af foer-vaerdier (sales_count, commission_sum, revenue_sum pr. dag) |
| Leaderboard | FM saelgere synlige med korrekte tal |
| TV board med rotation | Alle dashboards renderer korrekt |
| League standings | FM provisioner korrekte (product_pricing_rules, ikke overrides) |
| Rettigheder | Adgang styret af team_dashboard_permissions (uaendret) |
| Mobil layout | Sidebar-sheet virker, KPI-kort responsive |
| System Stability | Data Integrity panel viser groenne checks |

---

## Rollback-strategi

| Fase | Metode |
|------|--------|
| 1 (triggers) | `DROP TRIGGER` + `DROP FUNCTION` -- sale_items forbliver |
| 2 (utilities) | Git revert, gendan lokale kopier |
| 3 (ClientDashboard) | Git revert af dashboard-commits |
| 4 (DashboardShell) | Feature flag `USE_DASHBOARD_SHELL = false` |
| 5 (edge cleanup) | Redeploy tidligere version |
| 6 (observability) | Ingen rollback noedvendig (additivt) |

---

## Kode-impact

| Handling | Fjernet | Tilfojet | Netto |
|----------|---------|---------|-------|
| Database triggers + backfill + assertions | 0 | ~130 SQL | +130 |
| Shared utilities | ~225 | ~50 | -175 |
| ClientDashboard + migration | ~1.058 | ~200 | -858 |
| DashboardShell + TV | ~550 | ~200 | -350 |
| Edge function cleanup (FM) | ~400 | 0 | -400 |
| tv-dashboard-data handlere | ~1.200 | 0 | -1.200 |
| fmPricing.ts + imports | ~150 | 0 | -150 |
| Health checks + monitoring | 0 | ~120 | +120 |
| **Total** | **~3.583** | **~700** | **~-2.883** |

---

## Implementeringsraekkefoelge

```text
Fase 1 (step 1.1-1.8):  Database triggers + backfill + HARD GATE
Fase 2 (step 2.1-2.3):  Shared utilities (ingen synlige aendringer)
Fase 3 (step 3.1-3.5):  ClientDashboard + migration af 4 filer
Fase 4 (step 4.1-4.4):  DashboardShell + TV unification
  -- HARD GATE CHECK --
Fase 5 (step 5.1-5.6):  Edge function cleanup (kun efter gate)
Fase 6 (step 6.1-6.3):  Observability + monitoring
```

