
# Komplet Optimeringsplan: EditSalesRegistrations.tsx, Console.log Cleanup & .single() Audit

## Samlet Overblik

| Opgave | Omfang | Handling |
|--------|--------|----------|
| EditSalesRegistrations.tsx Migration | 1 kompleks CRUD-fil | Migrér fra `fieldmarketing_sales` → `sales` WHERE `source = 'fieldmarketing'` |
| Console.log Cleanup | ~3.000 matches i 81 filer | Fjern debug logs fra edge functions, behold kun errors |
| .single() → .maybeSingle() Audit | 610 matches i 60 filer | Erstat risikable SELECT queries med `.maybeSingle()` |

---

## FASE 1: EditSalesRegistrations.tsx FM Migration (KOMPLEKS CRUD)

### 1.1 Fil: `src/pages/vagt-flow/EditSalesRegistrations.tsx` (1.075 linjer)

**Kritiske ændringspunkter:**

| Linje | Nuværende | Ny Query |
|-------|-----------|----------|
| 135-150 | `from("fieldmarketing_sales").select(...)` | `from("sales").select(...).eq("source", "fieldmarketing")` |
| 241-244 | `from("fieldmarketing_sales").update(...)` | `from("sales").update(...)` med `raw_payload` mapping |
| 260-263 | `from("fieldmarketing_sales").delete(...)` | `from("sales").delete(...)` |
| 298-301 | Group delete `from("fieldmarketing_sales")` | `from("sales")` |
| 307-318 | Group update `from("fieldmarketing_sales")` | `from("sales")` med `raw_payload` |
| 332-335 | Group insert `from("fieldmarketing_sales")` | Brug `from("sales")` med FM struktur |

**Datamodel Transformation:**

```typescript
// NUVÆRENDE Interface (SaleRecord):
interface SaleRecord {
  id: string;
  seller_id: string;
  location_id: string | null;
  client_id: string | null;
  product_name: string | null;
  phone_number: string | null;
  comment: string | null;
  registered_at: string;
  ...
}

// NY Query fra `sales` tabel:
// Felter mappes via raw_payload:
// - seller_id → raw_payload->>'fm_seller_id' ELLER agent_name
// - location_id → raw_payload->>'fm_location_id'
// - client_id → raw_payload->>'fm_client_id'
// - product_name → raw_payload->>'fm_product_name'
// - phone_number → customer_phone
// - comment → raw_payload->>'fm_comment'
// - registered_at → sale_datetime
```

**Særlige hensyn:**
- Filen håndterer CRUD operationer (Create, Read, Update, Delete)
- INSERT operationer skal bruge `sales` tabellen med korrekt `source = 'fieldmarketing'`
- UPDATE skal opdatere `raw_payload` JSON felter
- Eksisterende `useCreateFieldmarketingSale` hook kan genbruges da den allerede skriver til `sales`

---

## FASE 2: Console.log Cleanup (3.000+ matches i 81 filer)

### 2.1 Prioriterede Edge Functions

| Fil | Matches | Handling |
|-----|---------|----------|
| `sync-adversus/index.ts` (2.119 LOC) | ~70+ | Fjern verbose debug, behold errors |
| `import-economic-zip/index.ts` (422 LOC) | ~20+ | Fjern sheet parsing logs |
| `enreach-manage-webhooks/index.ts` | ~50+ | Allerede delvist cleaned |
| `calculate-kpi-values/index.ts` | ~35+ | Allerede delvist cleaned |
| `calculate-kpi-incremental/index.ts` | ~15 | Behold kritiske watermark logs |
| `zapier-webhook/index.ts` | ~3 | Fjern verbose |
| `sync-contracts-to-sharepoint/index.ts` | ~8 | Fjern upload logs |
| `process-scheduled-emails/index.ts` | ~6 | Behold progress logs |
| `delete-auth-user/index.ts` | ~1 | Behold |
| `end-call/index.ts` | ~3 | Behold error handling |

### 2.2 sync-adversus Cleanup (STOR FIL - 2.119 LOC)

Specifik analyse af console.log statements:

| Linje | Type | Handling |
|-------|------|----------|
| 122-148 | `console.log('No campaign name...')` etc | FJERN - debug matching |
| 210-217 | `console.log('Matched outcome...')` | FJERN - verbose |
| 318-323 | `console.warn('Could not fetch lead')` | BEHOLD - error |
| 386 | `console.warn('Error while extracting OPP nr')` | BEHOLD - error |
| 451 | `console.warn('Error fetching sales')` | BEHOLD - error |
| 457 | `console.log('Starting Adversus sync...')` | FJERN - verbose |
| 490-525 | Debug fetch products logs | FJERN |
| 538-569 | Debug fetch campaigns logs | FJERN |
| 605-616 | Debug fetch sales logs | FJERN |
| 651-680 | TDC October sync logs | FJERN |

**Pattern for cleanup:**

```typescript
// FJERN alle disse:
console.log('Starting...')
console.log('Fetching...')
console.log('Found X items')
console.log(`Page ${page}: Got...`)

// BEHOLD kun:
console.error('Error:', error)
console.warn('Could not fetch...', err)

// BRUG struktureret logging for kritisk info:
// (integration-engine pattern)
const log = makeLogger({ function: "sync-adversus" });
log("ERROR", "Failed to fetch lead", { leadId, error });
```

### 2.3 import-economic-zip Cleanup

| Linje | Log | Handling |
|-------|-----|----------|
| 114 | `console.log(\`Excel sheets found: ...\`)` | FJERN |
| 123 | `console.log(\`Sheet "${sheetName}": ${rows.length} rows\`)` | FJERN |
| 131-136 | Matched sheet logs | FJERN |
| 162 | Using first sheet log | FJERN |
| 197 | `console.log(\`Processing import...\`)` | FJERN |
| 220-228 | File type detection logs | FJERN |
| 245 | Parsed CSV logs | FJERN |

---

## FASE 3: .single() → .maybeSingle() Audit (610 matches i 60 filer)

### 3.1 Risikovurdering Matrix

| Kategori | Mønster | Risiko | Handling |
|----------|---------|--------|----------|
| SIKKER | `.insert(...).select().single()` | Lav | BEHOLD - INSERT garanterer 1 række |
| SIKKER | `.update(...).eq("id", x).select().single()` | Lav | BEHOLD - UPDATE med kendt ID |
| RISIKABEL | `.select().eq("auth_user_id", x).single()` | HØJ | ERSTAT med `.maybeSingle()` |
| RISIKABEL | `.select().ilike("name", "%...%").single()` | HØJ | ERSTAT med `.maybeSingle()` |
| RISIKABEL | `.select().eq("team_id", x).single()` | HØJ | ERSTAT med `.maybeSingle()` |

### 3.2 Prioriterede Filer - Hooks (20 filer)

| Fil | Total | Kritiske | Handling |
|-----|-------|----------|----------|
| `useKpiFormulas.ts` | 2 | 1 | Linje 54-58: SELECT by id → `.maybeSingle()` |
| `usePulseSurvey.ts` | 6 | 4 | Linjer 30-36, 55-59, 63-68, 108-112 |
| `useReferrals.ts` | 5 | 2 | Linjer 245-249, 253-257 (employee lookup) |
| `useTimeStamps.ts` | 4 | 1 | Allerede fixed (bruger maybeSingle) |
| `useShiftPlanning.ts` | 8 | 3 | Linjer 140, 167, 330 (CREATE/UPDATE - sikre) |
| `useCelebrationData.ts` | 1 | 1 | Month lookup |
| `useFieldmarketingSales.ts` | 1 | 1 | Employee lookup |
| `useKpiDefinitions.ts` | 4 | 2 | SELECT queries |
| `useDashboardKpiData.ts` | 3 | 1 | Linje 903-905 (formula lookup) |
| `useIntegrationDebugLog.ts` | 1 | 1 | Linje 55-57 |
| `useEmployeeDashboards.ts` | 4 | 2 | Linje 209 (SELECT by id) |
| `useSomeContent.ts` | 4 | 2 | Linjer 94-96, 111-113 (upsert) |

### 3.3 Prioriterede Filer - Pages (23 filer)

| Fil | Kritiske | Linje | Problem |
|-----|----------|-------|---------|
| `Billing.tsx` | 1 | 57-61 | `.ilike("name", "%fieldmarketing%").single()` |
| `Bookings.tsx` | 1 | Similar team lookup |
| `BookingsContent.tsx` | 1 | Team lookup |
| `MarketsContent.tsx` | 1 | Team lookup |
| `BookWeekContent.tsx` | 1 | Team lookup |
| `MyGoals.tsx` | 2 | Employee lookup |
| `PulseSurvey.tsx` | 1 | Employee lookup |
| `CareerWishes.tsx` | 1 | Employee lookup |
| `RolePreview.tsx` | 2 | SELECT queries |
| `TvBoardLogin.tsx` | 1 | Access code lookup |
| `TvBoardView.tsx` | 1 | Access code lookup |
| `LeagueAdminDashboard.tsx` | 3 | SELECT queries |
| `ContractSign.tsx` | 1 | Contract lookup |
| `ClosingShifts.tsx` | 1 | Config lookup |
| `EmployeeMasterData.tsx` | 1 | Config lookup |
| `EconomicUpload.tsx` | 1 | SELECT query |
| `CandidateDetail.tsx` | 1 | SELECT query |

### 3.4 Prioriterede Filer - Komponenter (17 filer)

| Fil | Kritiske | Problem |
|-----|----------|---------|
| `ClientDBTab.tsx` | 2 | Linjer 161-163, 347-350 (lookups) |
| `ProductPricingRulesDialog.tsx` | 1 | Linje 161-163 (created_at lookup) |
| `H2HMatchHistory.tsx` | 1 | Stats lookup |
| `H2HPerformanceDashboard.tsx` | 1 | Stats lookup |
| `H2HPlayerStats.tsx` | 1 | Stats lookup |
| `HeadToHeadComparison.tsx` | 1 | Employee lookup |
| `StaffEmployeesTab.tsx` | 1 | Config lookup |
| `AddMemberDialog.tsx` | 1 | Cohort lookup |
| `EditBookingDialog.tsx` | 1 | Team lookup |
| `CallModal.tsx` | 1 | Call status lookup |
| `SalesFeed.tsx` | 1 | Realtime single fetch |

### 3.5 Fix Pattern

```typescript
// RISIKABEL (SELECT kan returnere 0 rækker):
const { data: team } = await supabase
  .from("teams")
  .select("id")
  .ilike("name", "%fieldmarketing%")
  .single(); // ❌ Crash hvis ikke fundet!

// SIKKER:
const { data: team } = await supabase
  .from("teams")
  .select("id")
  .ilike("name", "%fieldmarketing%")
  .maybeSingle(); // ✅ Returnerer null hvis ikke fundet

if (!team) {
  // Håndter manglende data gracefully
  return [];
}
```

---

## IMPLEMENTERINGSRÆKKEFØLGE

### Dag 1: EditSalesRegistrations.tsx Migration

| Prioritet | Handling | Kompleksitet |
|-----------|----------|--------------|
| 1 | Opdatér fetch query (linje 135-150) | Medium |
| 2 | Opdatér update mutation (linje 241-244) | Høj |
| 3 | Opdatér delete mutation (linje 260-263) | Lav |
| 4 | Opdatér group delete (linje 298-301) | Lav |
| 5 | Opdatér group update (linje 307-318) | Høj |
| 6 | Opdatér group insert (linje 332-335) | Medium |
| 7 | Test CRUD operationer grundigt | Kritisk |

### Dag 2: Console.log Cleanup - Edge Functions

| Prioritet | Fil | Matches |
|-----------|-----|---------|
| 8 | `sync-adversus/index.ts` | ~70 |
| 9 | `import-economic-zip/index.ts` | ~20 |
| 10 | `zapier-webhook/index.ts` | ~3 |
| 11 | `sync-contracts-to-sharepoint/index.ts` | ~8 |
| 12 | Andre mindre filer | ~50 |

### Dag 3-4: .single() Audit - Hooks

| Prioritet | Fil | Ændringer |
|-----------|-----|-----------|
| 13 | `useKpiFormulas.ts` | 1 |
| 14 | `usePulseSurvey.ts` | 4 |
| 15 | `useReferrals.ts` | 2 |
| 16 | `useCelebrationData.ts` | 1 |
| 17 | `useFieldmarketingSales.ts` | 1 |
| 18 | `useKpiDefinitions.ts` | 2 |
| 19 | `useDashboardKpiData.ts` | 1 |
| 20 | `useIntegrationDebugLog.ts` | 1 |
| 21 | `useEmployeeDashboards.ts` | 2 |
| 22 | `useSomeContent.ts` | 2 |

### Dag 5: .single() Audit - Pages & Komponenter

| Prioritet | Kategori | Filer | Ændringer |
|-----------|----------|-------|-----------|
| 23 | Pages (højrisiko) | `Billing.tsx`, `Bookings.tsx`, 5 andre | ~10 |
| 24 | Pages (medium) | `MyGoals.tsx`, `PulseSurvey.tsx`, 8 andre | ~12 |
| 25 | Komponenter | `ClientDBTab.tsx`, H2H filer, 10 andre | ~15 |

---

## FILER DER ÆNDRES

### EditSalesRegistrations.tsx (1 fil, 6 ændringer)

| Linje | Ændring |
|-------|---------|
| 135-150 | Fetch query → `sales` med source filter |
| 241-244 | Update → `sales` med raw_payload |
| 260-263 | Delete → `sales` |
| 298-301 | Group delete → `sales` |
| 307-318 | Group update → `sales` med raw_payload |
| 332-335 | Group insert → `sales` |

### Edge Functions - Console.log (8 filer, ~150 ændringer)

| Fil | Fjernes | Beholdes |
|-----|---------|----------|
| `sync-adversus/index.ts` | ~65 | ~5 errors |
| `import-economic-zip/index.ts` | ~18 | ~2 errors |
| `zapier-webhook/index.ts` | ~2 | ~1 error |
| `sync-contracts-to-sharepoint/index.ts` | ~6 | ~2 errors |
| `process-scheduled-emails/index.ts` | ~4 | ~2 progress |
| `delete-auth-user/index.ts` | 0 | ~1 |
| `end-call/index.ts` | ~1 | ~2 errors |
| Andre | ~20 | ~5 |

### Hooks - .single() Audit (12 filer, ~17 ændringer)

| Fil | Ændringer |
|-----|-----------|
| `useKpiFormulas.ts` | 1 |
| `usePulseSurvey.ts` | 4 |
| `useReferrals.ts` | 2 |
| `useCelebrationData.ts` | 1 |
| `useFieldmarketingSales.ts` | 1 |
| `useKpiDefinitions.ts` | 2 |
| `useDashboardKpiData.ts` | 1 |
| `useIntegrationDebugLog.ts` | 1 |
| `useEmployeeDashboards.ts` | 2 |
| `useSomeContent.ts` | 2 |

### Pages - .single() Audit (17 filer, ~22 ændringer)

| Fil | Ændringer |
|-----|-----------|
| `Billing.tsx` | 1 |
| `Bookings.tsx` | 1 |
| `BookingsContent.tsx` | 1 |
| `MarketsContent.tsx` | 1 |
| `BookWeekContent.tsx` | 1 |
| `MyGoals.tsx` | 2 |
| `PulseSurvey.tsx` | 1 |
| Andre 10 filer | ~14 |

### Komponenter - .single() Audit (11 filer, ~12 ændringer)

| Fil | Ændringer |
|-----|-----------|
| `ClientDBTab.tsx` | 2 |
| `ProductPricingRulesDialog.tsx` | 1 |
| H2H filer (4 stk) | 4 |
| Andre 5 filer | 5 |

---

## FORVENTET RESULTAT

| Metrik | Før | Efter | Forbedring |
|--------|-----|-------|------------|
| `fieldmarketing_sales` dependencies | 1 fil | 0 | -100% |
| Console.log i edge functions | ~3.000 | ~100 | -97% |
| .single() crash risiko | 60 filer | ~10 | -83% |
| Edge function log overhead | Høj | Minimal | Bedre performance |
| Runtime crashes (0 rækker) | Mulige | Forebygget | Stabil app |

---

## TEST PLAN

### EditSalesRegistrations.tsx Test

1. **Read:** Verificer at salg vises korrekt med ny query
2. **Update:** Opdater et salg og verificer data gemmes i `raw_payload`
3. **Delete:** Slet et salg og verificer det er væk
4. **Group Update:** Opdater en gruppe og verificer alle ændres
5. **Group Delete:** Slet en gruppe og verificer alle er væk
6. **Group Insert:** Tilføj nyt salg til gruppe

### Console.log Cleanup Test

1. Verificer edge functions stadig kører korrekt
2. Tjek at errors stadig logges
3. Verificer log output er reduceret i Supabase logs

### .single() Audit Test

1. Test hver ændret fil med edge case: lookup der returnerer 0 rækker
2. Verificer at UI håndterer null/undefined gracefully
3. Ingen runtime crashes ved manglende data
