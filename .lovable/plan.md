

## Komplet systemdaekkende paginering - Alle queries fremtidssikret

### Overblik

Planen daekker ALLE steder i systemet der bruger direkte Supabase-queries uden paginering. Opdelt i kritiske fixes (mister data NU) og forebyggende fixes (vil ramme graensen ved skalering).

---

### Fase 1: KRITISK - Mister data nu

#### 1.1 FieldmarketingDashboardFull.tsx (2 queries)

**topSellers query (linje 108-114):** Henter FM-salg for lonperioden - 1.487+ raekker, mangler ~487.

**todaySellers query (linje 153-158):** Henter FM-salg for i dag. Lavere risiko nu, men vokser.

**Fix:** Importer `fetchAllRows` og erstat begge direkte `.from("sales").select(...)` kald.

#### 1.2 useDashboardSalesData.ts - FM sales query (linje 306-318)

**Problem:** `supabase.from("sales").select(...).eq("source", "fieldmarketing")` uden paginering. Bruges af CPH Sales Dashboard.

**Fix:** Erstat med `fetchAllRows`.

#### 1.3 sync-adversus edge function - adversus_events dedup (linje 719)

**Problem:** `supabase.from('adversus_events').select('external_id')` - 10.877 raekker! Kun foerste 1.000 returneres, saa 9.877 events kan duplikeres.

**Fix:** Brug `fetchAllPaginated` fra `utils/batch.ts`.

---

### Fase 2: FOREBYGGENDE - Vokser mod graensen

#### 2.1 useDashboardKpiData.ts - shift query (linje 633-637)

**Nu:** 38 raekker. **Skalering:** Med 50 medarbejdere x 20 dage = 1.000 raekker/maaned.

**Fix:** Erstat med `fetchAllRows`.

#### 2.2 CphSalesDashboard.tsx - lookup-tabeller (linje 617-653)

**Nu:** teams (under 20), team_members (109), agents (169), employee_agent_mapping (119), team_clients (under 50).

**Skalering:** Ved 200+ medarbejdere rammer team_members og agents graensen.

**Fix:** Erstat alle 5 lookup-queries med `fetchAllRows`:
- `teams` (linje 617)
- `team_members` (linje 624)
- `agents` (linje 629-631)
- `employee_agent_mapping` (linje 636-638)
- `team_clients` (linje 649-651)

#### 2.3 useDashboardSalesData.ts - agents + employee_agent_mapping (linje 103, 110-113)

**Nu:** agents (169), mappings (119).

**Fix:** Erstat med `fetchAllRows`.

#### 2.4 useDashboardSalesData.ts - products + campaign_mappings (linje 321-333)

**Nu:** products (456), adversus_campaign_mappings (100).

**Skalering:** Products vokser med nye kunder/produkter.

**Fix:** Erstat med `fetchAllRows`.

#### 2.5 MgTest.tsx - agents query (linje 456)

**Nu:** 169 raekker.

**Fix:** Erstat med `fetchAllRows`.

#### 2.6 useOnboarding.ts - coaching tasks (linje 152)

**Nu:** 420 raekker (filtreres typisk per medarbejder, men kan hentes ufiltreret med `includeAll`).

**Fix:** Erstat med `fetchAllRows`.

#### 2.7 useEconomicData.ts - posteringer_enriched (linje 134)

**Nu:** 18 raekker. **Skalering:** View kan vokse hurtigt ved aktiv brug af oekonomisystemet.

**Fix:** Erstat med `fetchAllRows`.

#### 2.8 DesignDashboard.tsx - teams + clients (linje 258-260)

**Nu:** Begge under 50 raekker.

**Fix:** Erstat med `fetchAllRows` for konsistens.

#### 2.9 CandidateDetail.tsx - teams (linje 188)

**Nu:** Under 20 raekker.

**Fix:** Erstat med `fetchAllRows` for konsistens.

---

### Fase 3: Edge functions - forebyggende

#### 3.1 calculate-leaderboard-incremental - lookup-tabeller (linje 447-506)

**Queries uden paginering:**
- `agents` (linje 447) - 169 raekker
- `employee_agent_mapping` (linje 456-458) - 119 raekker
- `clients` (linje 501) - under 20
- `client_campaigns` (linje 504-506) - under 50

**Fix:** Brug `fetchAllPaginated` for agents og employee_agent_mapping. Clients og campaigns er OK men tilfoej for konsistens.

#### 3.2 adversus-sync-v2 - lookup-tabeller (linje 194-198)

**Queries uden paginering:**
- `products` (linje 194) - 456 raekker
- `adversus_product_mappings` (linje 195) - under 100
- `agents` (linje 198) - 169 raekker

**Fix:** Brug `fetchAllPaginated`.

#### 3.3 integration-engine/core/sales.ts - lookup-tabeller (linje 595-600)

**Queries uden paginering:**
- `products` (linje 596) - 456 raekker
- `adversus_product_mappings` (linje 597)
- `product_pricing_rules` (linje 598) - 275 raekker
- `adversus_campaign_mappings` (linje 599) - 100 raekker
- `dialer_integrations` (linje 600) - under 10

**Fix:** Brug `fetchAllPaginated`.

#### 3.4 integration-engine/core/calls.ts - agents (linje 122)

**Nu:** 169 raekker.

**Fix:** Brug `fetchAllPaginated`.

#### 3.5 sync-adversus - products (linje 723-725)

**Nu:** 456 raekker.

**Fix:** Brug `fetchAllPaginated`.

---

### Samlet filoversigt

| # | Fil | Antal queries | Prioritet |
|---|-----|--------------|-----------|
| 1 | `FieldmarketingDashboardFull.tsx` | 2 | KRITISK |
| 2 | `useDashboardSalesData.ts` | 4 | KRITISK + forebyggende |
| 3 | `sync-adversus/index.ts` | 2 | KRITISK + forebyggende |
| 4 | `useDashboardKpiData.ts` | 1 | Forebyggende |
| 5 | `CphSalesDashboard.tsx` | 5 | Forebyggende |
| 6 | `MgTest.tsx` | 1 | Forebyggende |
| 7 | `useOnboarding.ts` | 1 | Forebyggende |
| 8 | `useEconomicData.ts` | 1 | Forebyggende |
| 9 | `DesignDashboard.tsx` | 2 | Forebyggende |
| 10 | `CandidateDetail.tsx` | 1 | Forebyggende |
| 11 | `calculate-leaderboard-incremental/index.ts` | 4 | Forebyggende |
| 12 | `adversus-sync-v2/index.ts` | 3 | Forebyggende |
| 13 | `integration-engine/core/sales.ts` | 5 | Forebyggende |
| 14 | `integration-engine/core/calls.ts` | 1 | Forebyggende |

**Total: 14 filer, 33 queries der skal pagineres.**

### Edge function deploy

Foelgende edge functions skal redeployes:
- `sync-adversus`
- `calculate-leaderboard-incremental`
- `adversus-sync-v2`
- `integration-engine`

### Risiko

Lav. Alle aendringer bruger eksisterende, gennemtestede paginerings-utilities (`fetchAllRows` i frontend, `fetchAllPaginated` i edge functions). Ingen logik aendres - kun datakomplethed sikres.

