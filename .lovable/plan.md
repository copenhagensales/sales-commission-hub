
# Komplet Optimeringsplan: FM Migration, Console.log Cleanup & .single() Audit

## Samlet Overblik

| Opgave | Omfang | Handling |
|--------|--------|----------|
| FM Migration | 54 steder i 15 filer | Migrér fra `fieldmarketing_sales` → `sales` WHERE `source = 'fieldmarketing'` |
| Console.log Cleanup | ~247 kritiske i edge functions | Fjern debug logs, behold kun errors |
| .single() Audit | 610 matches i 60 filer | Erstat risikable med `.maybeSingle()` |

---

## FASE 1: FM Migration (54 steder i 15 filer)

### 1.1 Edge Functions (3 filer, 12 steder)

**`supabase/functions/calculate-kpi-values/index.ts`** (9 steder)

| Linje | Nuværende | Ny Query |
|-------|-----------|----------|
| 437-441 | `from("fieldmarketing_sales").select("id, product_name, seller_id...")` | `from("sales").select("id, raw_payload, agent_name...").eq("source", "fieldmarketing")` |
| 987-991 | `fetchFmSalesForPeriod` funktion | Opdatér til `sales` tabel med mapping |
| 1628-1632 | FM count query | `.eq("source", "fieldmarketing")` |
| 1662-1666 | FM commission query | Brug `raw_payload->>'fm_product_name'` |
| 1703-1707 | FM revenue query | Brug `raw_payload` |
| 2060-2065 | Client-scoped FM count | Tilføj `source` filter |
| 2096-2101 | Client-scoped FM commission | Brug `raw_payload` |
| 2138-2143 | Client-scoped FM revenue | Brug `raw_payload` |

**Field Mapping (fra useFieldmarketingSales.ts):**
```typescript
// seller_id → raw_payload->>'fm_seller_id' ELLER agent_name
// product_name → raw_payload->>'fm_product_name'
// registered_at → sale_datetime
// client_id → raw_payload->>'fm_client_id' ELLER via client_campaign_id
// location_id → raw_payload->>'fm_location_id'
// comment → raw_payload->>'fm_comment'
```

**`supabase/functions/parse-expense-formula/index.ts`** (1 sted)

| Linje | Handling |
|-------|----------|
| 307-312 | Opdatér query til `sales` med `source = 'fieldmarketing'`, brug `raw_payload` for location_id |

**`supabase/functions/league-calculate-standings/index.ts`** (1 sted)

| Linje | Handling |
|-------|----------|
| 211-215 | Opdatér FM sales query til `sales` tabel med korrekt mapping |

### 1.2 Frontend - Hooks (3 filer, 10 steder)

**`src/hooks/useKpiTest.ts`** (6 steder)

| Linje | Funktion | Handling |
|-------|----------|----------|
| 200-210 | `testSalesCount` FM query | Brug `sales` med `source = 'fieldmarketing'` |
| 346-356 | `testTotalCommission` FM query | Opdatér med `raw_payload` mapping |
| 492-502 | `testTotalRevenue` FM query | Opdatér med `raw_payload` mapping |

**`src/components/kpi/FormulaLiveTest.tsx`** (2 steder)

| Linje | Handling |
|-------|----------|
| 428-432 | FM sales URL fetch | Opdatér REST URL til `sales?source=eq.fieldmarketing` |
| 627-630 | FM revenue fetch | Samme opdatering |

**`src/hooks/useFieldmarketingSales.ts`** - ALLEREDE MIGRERET ✓

Denne fil bruger allerede den korrekte tilgang med `sales` tabel og `source = 'fieldmarketing'`.

### 1.3 Frontend - Komponenter & Pages (9 filer, 31 steder)

**`src/pages/vagt-flow/EditSalesRegistrations.tsx`** (8 steder - KOMPLEKS CRUD)

| Linje | Handling |
|-------|----------|
| 135-150 | Fetch sales query | Opdatér til `sales` med `source = 'fieldmarketing'` |
| 241-244 | Update mutation | Opdatér til `sales` tabel med `raw_payload` |
| 260-263 | Delete mutation | Opdatér til `sales` tabel |
| 298-301 | Group delete | Opdatér til `sales` tabel |
| 307-318 | Group update | Opdatér til `sales` tabel med `raw_payload` |
| 332-335 | Group insert | Brug eksisterende `useCreateFieldmarketingSale` hook |

**Bemærk:** Denne fil kræver særlig omhu da den håndterer CRUD operationer. Skal bruge eksisterende `useCreateFieldmarketingSale` hook der allerede skriver til `sales` tabellen.

**`src/pages/dashboards/FieldmarketingDashboardFull.tsx`** (2 steder)

| Linje | Handling |
|-------|----------|
| 107-116 | Period sellers query | Opdatér til `sales` med `source` filter |
| 146-154 | Today sellers query | Opdatér til `sales` med `source` filter |

**`src/components/employee/EmployeeCommissionHistory.tsx`** (1 sted)

| Linje | Handling |
|-------|----------|
| 185-188 | FM sales query | Opdatér til `sales` tabel |

**`src/components/dashboard/DailyRevenueChart.tsx`** (1 sted)

| Linje | Handling |
|-------|----------|
| 128-132 | FM sales revenue query | Opdatér til `sales` med `raw_payload` |

**`src/pages/dashboards/CphSalesDashboard.tsx`** (1 sted - allerede delvist migreret via hooks)

Bruger `useFieldmarketingSalesStats` som allerede er migreret.

**`src/components/salary/ClientDBTab.tsx`** (1 sted)

Bruger allerede `useFieldmarketingSales` hook - ingen ændring nødvendig.

**`src/pages/reports/DailyReports.tsx`** (2 steder)

| Handling |
|----------|
| Opdatér FM queries til `sales` tabel |

**`src/pages/reports/RevenueByClient.tsx`** (1 sted)

| Handling |
|----------|
| Opdatér FM query til `sales` tabel |

**`src/pages/MyProfile.tsx`** (2 steder)

| Handling |
|----------|
| Opdatér FM queries til `sales` tabel |

---

## FASE 2: Console.log Cleanup (247+ kritiske i edge functions)

### 2.1 Prioriterede Edge Functions

| Fil | Matches | Handling |
|-----|---------|----------|
| `enreach-manage-webhooks/index.ts` | ~50 | Fjern alle debug logs, behold kun errors |
| `calculate-kpi-values/index.ts` | ~35 | Fjern debug logs, behold kritiske metrics |
| `sync-adversus/index.ts` | ~30 | Fjern verbose logging |
| `integration-engine/*.ts` | ~25 | Brug eksisterende `makeLogger()` |
| `parse-expense-formula/index.ts` | ~15 | Fjern context dumps |
| `import-economic-zip/index.ts` | ~15 | Reducer til progress logs |
| `tv-dashboard-data/index.ts` | ~50 | Allerede delvist cleaned i forrige iteration |

### 2.2 Cleanup Pattern

```typescript
// FJERN alle disse:
console.log("...");
console.log("Fetching...");
console.log("Found X items");
console.log("Processing...");

// BEHOLD kun:
console.error("Error:", error);

// BRUG struktureret logging hvor nødvendigt:
// I integration-engine:
const log = makeLogger({ function: "name", context: {} });
log("INFO", "message", data);
```

### 2.3 Specifik Cleanup for enreach-manage-webhooks

```typescript
// Linje 43-52: FJERN
console.log("=== ENREACH WEBHOOK MANAGER START ===");
console.log("Raw request body:", ...);
console.log("Parsed parameters:");

// Linje 55-56: BEHOLD (fejlhåndtering)
console.log("ERROR: Missing required parameters"); // Omdøb til console.error

// Linje 62-74: FJERN (verbose debugging)
console.log("Fetching integration details...");

// osv. for alle 50+ matches
```

---

## FASE 3: .single() → .maybeSingle() Audit (610 matches i 60 filer)

### 3.1 Risikovurdering

| Kategori | Mønster | Risiko | Handling |
|----------|---------|--------|----------|
| SIKKER | `.insert(...).select().single()` | Lav | Behold (INSERT garanterer 1 række) |
| SIKKER | `.update(...).select().single()` | Lav | Behold (UPDATE returnerer opdateret række) |
| RISIKABEL | `.select().eq("id", x).single()` | Høj | Erstat med `.maybeSingle()` |
| RISIKABEL | `.select().eq("auth_user_id", x).single()` | Høj | Erstat med `.maybeSingle()` |

### 3.2 Prioriterede Filer (Høj Risiko)

**Hooks (20 filer, ~150 matches)**

| Fil | Matches | Kritiske |
|-----|---------|----------|
| `useKpiTest.ts` | 6 | 6 (SELECT queries) |
| `useDashboardKpiData.ts` | 3 | 1 (formula lookup) |
| `useKpiFormulas.ts` | 4 | 2 (SELECT by id) |
| `usePulseSurvey.ts` | 6 | 4 (SELECT queries) |
| `useReferrals.ts` | 5 | 2 (SELECT queries) |
| `useTimeStamps.ts` | 4 | 1 (SELECT by id) |
| `useShiftPlanning.ts` | 8 | 3 (SELECT queries) |
| `useSomeContent.ts` | 4 | 2 (upsert handling) |
| `useCelebrationData.ts` | 1 | 1 (month lookup) |
| `useFieldmarketingSales.ts` | 1 | 1 (employee lookup) |
| `useSystemRoles.ts` | 1 | 0 (INSERT) |
| `useKpiDefinitions.ts` | 4 | 2 (SELECT queries) |

**Pages (23 filer, ~100 matches)**

| Fil | Matches | Kritiske |
|-----|---------|----------|
| `MyGoals.tsx` | 2 | 2 (employee lookup) |
| `PulseSurvey.tsx` | 1 | 1 (employee lookup) |
| `CareerWishes.tsx` | 1 | 1 (employee lookup) |
| `RolePreview.tsx` | 2 | 2 (SELECT queries) |
| `ClosingShifts.tsx` | 1 | 1 (config lookup) |
| `ContractSign.tsx` | 1 | 1 (contract lookup) |
| `EmployeeMasterData.tsx` | 1 | 1 (config lookup) |
| `LeagueAdminDashboard.tsx` | 4 | 3 (SELECT queries) |
| `EconomicUpload.tsx` | 2 | 1 (SELECT query) |
| `TvBoardLogin.tsx` | 1 | 1 (access code lookup) |
| `TvBoardView.tsx` | 1 | 1 (access code lookup) |
| `Billing.tsx` | 1 | 1 (team lookup) |
| `Bookings.tsx` | 1 | 1 (team lookup) |
| `BookingsContent.tsx` | 1 | 1 (team lookup) |
| `MarketsContent.tsx` | 1 | 1 (team lookup) |
| `BookWeekContent.tsx` | 1 | 1 (team lookup) |
| `CandidateDetail.tsx` | 2 | 1 (SELECT query) |
| `UpcomingStarts.tsx` | 1 | 0 (INSERT) |
| `Settings.tsx` | 1 | 0 (INSERT) |
| `TvBoardAdmin.tsx` | 1 | 0 (INSERT) |

**Komponenter (17 filer, ~90 matches)**

| Fil | Matches | Kritiske |
|-----|---------|----------|
| `StaffEmployeesTab.tsx` | 1 | 1 (config lookup) |
| `AddMemberDialog.tsx` | 1 | 1 (cohort lookup) |
| `EditBookingDialog.tsx` | 1 | 1 (team lookup) |
| `CallModal.tsx` | 1 | 1 (call status lookup) |
| `PricingRuleEditor.tsx` | 1 | 0 (INSERT) |
| `SalesFeed.tsx` | 1 | 1 (realtime single fetch) |
| `NewCandidateDialog.tsx` | 1 | 0 (INSERT) |
| `TeamsTab.tsx` | 1 | 0 (INSERT) |
| `SendContractDialog.tsx` | 1 | 0 (INSERT) |
| `HeadToHeadComparison.tsx` | 1 | 1 (employee lookup) |
| `H2HPerformanceDashboard.tsx` | 1 | 1 (stats lookup) |
| `ProductPricingRulesDialog.tsx` | 1 | 1 (created_at lookup) |
| `H2HMatchHistory.tsx` | 1 | 1 (stats lookup) |
| `ClientDBTab.tsx` | 2 | 2 (lookups) |
| `H2HPlayerStats.tsx` | 1 | 1 (stats lookup) |
| `TeamStandardShifts.tsx` | 1 | 0 (INSERT) |

### 3.3 Fix Pattern

```typescript
// RISIKABEL (SELECT med WHERE - kan returnere 0 rækker):
const { data, error } = await supabase
  .from("employee_master_data")
  .select("*")
  .eq("auth_user_id", userId)
  .single(); // ❌ Crash hvis ikke fundet!

// SIKKER:
const { data, error } = await supabase
  .from("employee_master_data")
  .select("*")
  .eq("auth_user_id", userId)
  .maybeSingle(); // ✅ Returnerer null hvis ikke fundet

if (!data) {
  // Håndter manglende data
  return null;
}
```

---

## IMPLEMENTERINGSRÆKKEFØLGE

### Dag 1: FM Migration - Edge Functions (Fase 1.1)

| Prioritet | Fil | Ændringer |
|-----------|-----|-----------|
| 1 | `calculate-kpi-values/index.ts` | 9 steder - opdatér alle FM queries |
| 2 | `parse-expense-formula/index.ts` | 1 sted |
| 3 | `league-calculate-standings/index.ts` | 1 sted |

### Dag 2: FM Migration - Frontend Hooks (Fase 1.2)

| Prioritet | Fil | Ændringer |
|-----------|-----|-----------|
| 4 | `useKpiTest.ts` | 6 steder |
| 5 | `FormulaLiveTest.tsx` | 2 steder |

### Dag 3: FM Migration - Frontend Pages (Fase 1.3)

| Prioritet | Fil | Ændringer |
|-----------|-----|-----------|
| 6 | `EditSalesRegistrations.tsx` | 8 steder (CRUD - kompleks) |
| 7 | `FieldmarketingDashboardFull.tsx` | 2 steder |
| 8 | `EmployeeCommissionHistory.tsx` | 1 sted |
| 9 | `DailyRevenueChart.tsx` | 1 sted |
| 10 | `DailyReports.tsx` | 2 steder |
| 11 | `RevenueByClient.tsx` | 1 sted |
| 12 | `MyProfile.tsx` | 2 steder |

### Dag 4: Console.log Cleanup (Fase 2)

| Prioritet | Fil | Matches |
|-----------|-----|---------|
| 13 | `enreach-manage-webhooks/index.ts` | ~50 |
| 14 | `calculate-kpi-values/index.ts` | ~35 |
| 15 | `sync-adversus/index.ts` | ~30 |
| 16 | `integration-engine/*.ts` | ~25 |
| 17 | `parse-expense-formula/index.ts` | ~15 |
| 18 | `import-economic-zip/index.ts` | ~15 |

### Dag 5: .single() Audit (Fase 3)

| Prioritet | Kategori | Filer | Kritiske Changes |
|-----------|----------|-------|------------------|
| 19 | Hooks (højrisiko) | 12 filer | ~25 ændringer |
| 20 | Pages (højrisiko) | 17 filer | ~20 ændringer |
| 21 | Komponenter | 15 filer | ~15 ændringer |

---

## FILER DER ÆNDRES

### Edge Functions (6 filer)

| Fil | FM Migration | Console.log | Total Ændringer |
|-----|--------------|-------------|-----------------|
| `calculate-kpi-values/index.ts` | 9 steder | ~35 logs | 44 |
| `parse-expense-formula/index.ts` | 1 sted | ~15 logs | 16 |
| `league-calculate-standings/index.ts` | 1 sted | ~5 logs | 6 |
| `enreach-manage-webhooks/index.ts` | - | ~50 logs | 50 |
| `sync-adversus/index.ts` | - | ~30 logs | 30 |
| `import-economic-zip/index.ts` | - | ~15 logs | 15 |

### Frontend - Hooks (12 filer)

| Fil | FM Migration | .single() Audit |
|-----|--------------|-----------------|
| `useKpiTest.ts` | 6 steder | 6 |
| `useKpiFormulas.ts` | - | 2 |
| `usePulseSurvey.ts` | - | 4 |
| `useReferrals.ts` | - | 2 |
| `useTimeStamps.ts` | - | 1 |
| `useShiftPlanning.ts` | - | 3 |
| `useSomeContent.ts` | - | 2 |
| `useCelebrationData.ts` | - | 1 |
| `useFieldmarketingSales.ts` | - | 1 |
| `useSystemRoles.ts` | - | 0 |
| `useKpiDefinitions.ts` | - | 2 |
| `useDashboardKpiData.ts` | - | 1 |

### Frontend - Pages & Komponenter (25 filer)

| Fil | FM Migration | .single() Audit |
|-----|--------------|-----------------|
| `EditSalesRegistrations.tsx` | 8 steder | - |
| `FieldmarketingDashboardFull.tsx` | 2 steder | - |
| `FormulaLiveTest.tsx` | 2 steder | - |
| `EmployeeCommissionHistory.tsx` | 1 sted | - |
| `DailyRevenueChart.tsx` | 1 sted | - |
| `DailyReports.tsx` | 2 steder | - |
| `RevenueByClient.tsx` | 1 sted | - |
| `MyProfile.tsx` | 2 steder | - |
| `MyGoals.tsx` | - | 2 |
| `PulseSurvey.tsx` | - | 1 |
| `CareerWishes.tsx` | - | 1 |
| `RolePreview.tsx` | - | 2 |
| `Billing.tsx` | - | 1 |
| `Bookings.tsx` | - | 1 |
| `TvBoardLogin.tsx` | - | 1 |
| `TvBoardView.tsx` | - | 1 |
| `LeagueAdminDashboard.tsx` | - | 3 |
| Andre (8 filer) | - | 8 |

---

## FORVENTET RESULTAT

| Metrik | Før | Efter | Forbedring |
|--------|-----|-------|------------|
| FM kode duplikering | 54 steder i 15 filer | 0 (unified) | -100% |
| fieldmarketing_sales dependencies | 15 filer | 0 | -100% |
| Console.log i edge functions | ~247 kritiske | ~20 (kun errors) | -92% |
| .single() crash risiko | 60+ filer, ~60 kritiske | ~10 (sikre patterns) | -83% |
| Edge function log overhead | Høj | Minimal | Bedre performance |
| Runtime crashes (0 rækker) | Mulige | Forebygget | Stabil app |

---

## TEKNISKE NOTER

### FM Migration - Data Mapping Reference

Fra `useFieldmarketingSales.ts` (allerede implementeret):

```typescript
// FM_CLIENT_CAMPAIGN_MAP for korrekt mapping
const FM_CLIENT_CAMPAIGN_MAP: Record<string, string> = {
  "9a92ea4c-6404-4b58-be08-065e7552d552": "c527b6a1-2aaa-42c9-a290-4933675c3800", // Eesy FM → Eesy gaden
  "5011a7cd-bf07-4838-a63f-55a12c604b40": "743980b0-1a1e-411e-a952-ec7f52681a54", // YouSee → Yousee gaden
};

// Transformation fra sales til FieldmarketingSale interface:
{
  id: s.id,
  seller_id: s.raw_payload?.fm_seller_id || "",
  location_id: s.raw_payload?.fm_location_id || "",
  client_id: s.raw_payload?.fm_client_id || "",
  product_name: s.raw_payload?.fm_product_name || "",
  phone_number: s.customer_phone || "",
  comment: s.raw_payload?.fm_comment || null,
  registered_at: s.sale_datetime,
  validation_status: s.validation_status || "pending",
}
```

### Console.log - makeLogger Pattern

Fra `integration-engine/utils/logging.ts`:

```typescript
export function makeLogger(context: Record<string, unknown>) {
  return (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => {
    console.log(JSON.stringify({ type, msg, data, context, timestamp: new Date().toISOString() }))
  }
}
```

Brug dette pattern i alle edge functions for struktureret logging.

### .single() - Sikre vs Risikable Patterns

```typescript
// ✅ SIKKER - INSERT garanterer 1 række
.insert({ ... }).select().single()

// ✅ SIKKER - UPDATE med eksisterende id
.update({ ... }).eq("id", knownId).select().single()

// ❌ RISIKABEL - SELECT kan returnere 0 rækker
.select().eq("auth_user_id", userId).single()

// ❌ RISIKABEL - Lookup by email/name
.select().ilike("name", "%fieldmarketing%").single()

// ❌ RISIKABEL - Config lookup der måske ikke findes
.select().eq("team_id", teamId).single()
```
