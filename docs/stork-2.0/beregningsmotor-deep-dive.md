# Beregningsmotoren i Stork 1.0 — deep dive

Forarbejde til Lag E (Stork 2.0). Faktarapport, ingen anbefalinger.

Scope:
- Hvad et salg er værd i provision og omsætning.
- Pricing, kampagne-aware matching, og aggregering pr. sælger pr. periode.
- IKKE: lønaggregat (timer, bonus, fradrag), IKKE: annulleringsmatching.

Empirisk grundlag:
- Kode læst direkte fra repo `/home/user/sales-commission-hub` (state pr. 2026-05-13).
- DB-state læst fra `docs/system-snapshot.md` (auto-genereret).
- Live Supabase MCP er forbundet til projekt `Projekt Stork 2.0` (greenfield, tomt). Ingen direkte query mod 1.0-produktion.

---

## 1. Forretningsdomænet i én sætning

Et salg ender altid i `sales` (header) + nul/flere `sale_items` (linjer). Hver `sale_item.mapped_commission` og `mapped_revenue` er det endelige tal. Alt andet er udregning af de to felter eller aggregering af dem.

## 2. Datamodellen (kerne — feltlisten)

Tællinger fra `docs/system-snapshot.md`.

### `sales` — 35 513 rækker
Header pr. salg. Nøglekolonner:
- `id`, `sale_datetime` (timestamptz, NOT NULL, primært tidsstempel)
- `adversus_external_id` (unik for TM-salg, NULL for FM)
- `source` (`'adversus'`, `'enreach'`, `'fieldmarketing'`, …)
- `integration_type` (`'adversus'`, `'enreach'`, `'manual'`, `'webhook'`)
- `dialer_campaign_id` (tekst, eksternt id fra dialer)
- `client_campaign_id` (uuid, FK → `client_campaigns`)
- `agent_name`, `agent_email`, `agent_external_id` — sælger-identifikation
- `validation_status` (`'pending'`, `'approved'`, `'rejected'`, `'cancelled'`)
- `raw_payload` jsonb — alt rådata
- `normalized_data` jsonb — PII-normaliseret variant (lag D)
- `internal_reference` (MG-YYYYMM-NNNNN, genereres via trigger)
- `enrichment_status`, `enrichment_attempts`, `enrichment_last_attempt`, `enrichment_error`

Bemærk: `agent_id` ligger IKKE som kolonne (sml. `docs/system-snapshot.md:349313-349338`). `adversus-webhook/index.ts:283` skriver alligevel `agent_id` i sin insert — den kolonne er enten fjernet eller migreret, koden er ikke fulgt med. Se §10.

Triggere på `sales`:
- `enrich_fm_sale_trigger` BEFORE INSERT
- `trg_enrich_fm_sale` BEFORE INSERT *(samme funktion, duplikat)*
- `create_fm_sale_items_trigger` AFTER INSERT
- `trg_create_fm_sale_items` AFTER INSERT *(samme funktion, duplikat)*
- `trg_generate_sales_internal_reference` BEFORE INSERT
- `validate_sales_email_trigger` BEFORE INSERT + BEFORE UPDATE
- `update_sales_updated_at` BEFORE UPDATE

### `sale_items` — 43 006 rækker
En linje pr. produkt på et salg. Nøglekolonner:
- `id`, `sale_id` (FK → sales), `product_id` (uuid, nullable)
- `adversus_external_id`, `adversus_product_title` — det dialer-sendte produktnavn/id
- `quantity` (default 1), `unit_price` (default 0)
- `mapped_commission` (numeric, default 0) — **det endelige provisionstal**
- `mapped_revenue` (numeric, default 0) — **det endelige omsætningstal**
- `matched_pricing_rule_id` (FK → product_pricing_rules, nullable)
- `display_name` — UI-navn (kan stamme fra prisreglen via `use_rule_name_as_display`)
- `is_cancelled` (boolean), `cancelled_quantity` (integer)
- `is_immediate_payment` (boolean) — ASE straksbetaling
- `needs_mapping` (boolean) — flag når produktet ikke kunne mappes
- `raw_data` jsonb — det rå produkt-payload

Ingen trigger på `sale_items`.

### `products` — 444 rækker
- `id`, `name`, `client_campaign_id`
- `commission_dkk` (default 0), `revenue_dkk` (default 0) — basispris-fallback
- `counts_as_sale` (default true), `counts_as_cross_sale` (default false)
- `is_active`, `is_hidden`, `priority`
- `merged_into_product_id` (uuid, nullable) — peger på det produkt sammenkøb-ramte ind i
- `external_product_code`

### `product_pricing_rules` — 280 rækker
Det aktive regelregister.
- `id`, `product_id`, `name`
- `commission_dkk` (NOT NULL), `revenue_dkk` (NOT NULL)
- `priority` (integer, default 0) — højere vinder ved konflikt
- `conditions` jsonb (default `{}`) — `{ "feltnavn": "værdi" | { operator, value, value2?, values? } }`
- `campaign_mapping_ids` uuid[] — liste af `adversus_campaign_mappings.id`
- `campaign_match_mode` text NOT NULL DEFAULT `'include'` (`'include'` eller `'exclude'`)
- `effective_from` date DEFAULT `CURRENT_DATE`
- `effective_to` date NULL
- `is_active` boolean DEFAULT true
- `allows_immediate_payment` boolean DEFAULT false
- `immediate_payment_commission_dkk` numeric NULL
- `immediate_payment_revenue_dkk` numeric NULL
- `use_rule_name_as_display` boolean DEFAULT false

Eksempler fra prod (`docs/system-snapshot.md:347969-348039`):
- En "Specialkampagne 2026"-regel: `priority=10`, `campaign_match_mode='exclude'`, 20 kampagne-ids ekskluderet, `effective_from=2026-01-01`.
- En inaktiv "Adversus"-regel: `priority=0`, `is_active=false`, `campaign_match_mode='include'`.

### `pricing_rule_history` — historik (ikke trigger-drevet)
Skema (fra migration `20260206185519`):
- Snapshot af regel + `changed_at`, `changed_by`, `change_type` (`'create'`, `'update'`, `'delete'`, eller fri tekst som `'pre-rematch-snapshot-2026-04-28'`).

**Vigtigt: Ingen DB-trigger skriver til denne tabel.** Den fyldes manuelt fra UI'et: `src/components/mg-test/PricingRuleEditor.tsx:281,294` indsætter en række efter hver mutation. Konsekvens: SQL-ændringer på regler (migrations, edge functions, direkte psql) registreres IKKE i historikken.

### `product_campaign_overrides` — 100 rækker
Skema (fra `docs/system-snapshot.md:347692-347748`):
- `product_id`, `campaign_mapping_id`, `commission_dkk`, `revenue_dkk`
- UNIQUE på `(product_id, campaign_mapping_id)`

**Status: Ikke død, men ikke læst af pricing-motoren.** Eksplicit verificeret med grep:
- Læses fra UI: `src/components/mg-test/ProductCampaignOverrides.tsx`, `src/components/mg-test/ProductMergeDialog.tsx`, `src/pages/MgTest.tsx`.
- Læses IKKE af nogen edge function, RPC, eller pricing-trigger.
- I tre frontend-filer (`DailyRevenueChart.tsx`, `RevenueByClient.tsx`, `DailyReports.tsx`, `useDashboardSalesData.ts`) står kommentarer som "*replaces deprecated product_campaign_overrides*" — disse læser fra `product_pricing_rules` i stedet.
- Pricing-motoren (`integration-engine`, `rematch-pricing-rules`, `create_fm_sale_items`, `heal_fm_missing_sale_items`, `_shared/pricing-service.ts`, `src/lib/calculations/fmPricing.ts`) refererer ALDRIG til denne tabel.

CLAUDE.md anførte 76 rækker; snapshot viser 100. Tallet er steget — nogen bruger UI'et aktivt på en tabel der ikke længere har effekt.

### `product_price_history` — 172 rækker
Historisk basispris pr. produkt med `effective_from`, `is_retroactive`. Bruges af UI til at vise historik, men er IKKE en pricing-kilde for sale_items. Skrives fra UI; ingen trigger.

### `product_change_log` og `product_merge_history`
- `product_change_log`: pr-sale_item historik når basket-difference annulleringer ændrer produkt (commission/revenue diff).
- `product_merge_history`: når to produkter merges, logges flyt af mappings/sale_items/pricing_rules.

Begge er bivirkninger af annullering/merge, ikke selve pricing-motoren.

### `commission_transactions` — 0 rækker (eller PII-skjult)
Skema (fra `docs/system-snapshot.md:4979-5013`):
- `sale_id`, `agent_name`, `client_id`, `transaction_type`, `amount`, `reason`, `source`, `source_reference`

**Status: Død kode-vej.** Eneste writer er `supabase/functions/sync-adversus/index.ts:2063` — og koden bruger forkerte kolonnenavne (`agent_id`, `type` i stedet for `agent_name`, `transaction_type`). Ingen frontend-fil læser fra tabellen (`grep -r "commission_transactions" src/` finder kun TypeScript-typegenerering). `sync-adversus` er ikke længere kaldt fra frontend (kun `integration-engine` kaldes fra `Settings.tsx`, `MgTest.tsx`). CLAUDE.md kalder den "Top 10 tabeller der ALDRIG må slettes/truncates", men den indeholder ikke aktive data.

### `kpi_*` tabeller
- `kpi_cached_values`, `kpi_definitions`, `kpi_period_snapshots`, `kpi_health_snapshots`, `kpi_leaderboard_cache`, `kpi_watermarks`, `kpi_dual_read_compare`, `kpi_reconcile_schedule`.

Cache-lag for TV-boards. Læses af edge function `calculate-kpi-incremental`. Ikke selve pricing — beregner KPI'er FRA `sale_items.mapped_commission/revenue`. Ligger uden for beregningsmotorens kerne.

### `adversus_campaign_mappings` — link dialer ↔ Stork
- `adversus_campaign_id` (text, dialer-id) → `client_campaign_id` (uuid, Stork)
- `id` (uuid, Stork-id, det er **dette** id pricing-regler bruger i `campaign_mapping_ids`)

### `adversus_product_mappings`
- `adversus_external_id` (text), `adversus_product_title` (text), `product_id` (uuid)
- Bruges af integration-engine til at oversætte dialer-produkter til Stork-produkter.

---

## 3. To engines — TM og FM

Stork har TO uafhængige beregningsmotorer, og forskellene er substantielle.

### 3.1 TM (telemarketing) — Adversus + Enreach

Indgang: dialer-payload → flere veje:

1. **`adversus-webhook`** (live, push fra Adversus)
   - `supabase/functions/adversus-webhook/index.ts:110-470`.
   - Modtager raw payload, gemmer i `adversus_events`, opretter `sales`-række, opretter `sale_items`.
   - Pricing: **kun base `products.commission_dkk` × quantity**, ingen kampagne-matching, ingen pricing rules.
     - `index.ts:323-358`: efter mapping → SELECT commission_dkk fra products.
     - `index.ts:410-411`: `mapped_commission: commission * product.quantity`.
   - Same-day correction: hvis samme `result_id` igen samme dag, slettes tidligere `sales` + `sale_items` og det nye salg indsættes (`index.ts:189-248`).
   - **Forskellige dage = nyt event ignoreres** (`index.ts:225-239`).

2. **`integration-engine`** (pull, kører via cron pr. integration)
   - Hver integration har sit eget cron-schedule (`migrations/20260218101500_*`):
     - `lovablecph`: `1,6,11,…` (hver 5. min)
     - `relatel_cphsales`: `3,8,13,…`
     - `eesy`: `0,5,10,15,…`
     - `tryg`: `2,7,12,…`
     - `ase`: `4,9,14,…`
   - Cron-jobs hedder `dialer-<8-char>-sync`. **Migrations opretter cron-skeduleringerne — selve `cron.schedule()`-kaldet for individuelle jobs sker via `dialer_integrations.config.sync_schedule` plus en RPC** (`migrations/20260116023141_*`, `migrations/20260208155941_*`).
   - Entry: `supabase/functions/integration-engine/index.ts:19-333`.
   - Adapter henter rådata: `adapters/adversus.ts`, `adapters/enreach.ts`. Mapper til `StandardSale`.
   - **Pricing-kernen ligger i `integration-engine/core/sales.ts:105-254` `matchPricingRule()`**. Dette er TM's kanoniske engine.
   - Insert: `processSalesBatch` (`sales.ts:407-617`) upserter `sales` på `adversus_external_id` (`onConflict: "adversus_external_id"`), sletter eksisterende `sale_items` for samme sale_id, og indsætter friske.
   - Preserverer `is_immediate_payment` ved re-sync: `sales.ts:537-559`.
   - Filtrerer salg uden gyldig sync-email: `sales.ts:35-98` (kun `@copenhagensales.dk`, `@cph-relatel.dk`, `@cph-sales.dk`, plus 2 whitelisted gmail).

3. **`sync-adversus`** (legacy)
   - `supabase/functions/sync-adversus/index.ts` findes stadig (kalder `commission_transactions`-insert med forkerte kolonner). **Ikke kaldt fra frontend.** Markeres som død.

4. **`rematch-pricing-rules`** (rematch på krav)
   - `supabase/functions/rematch-pricing-rules/index.ts:1-892`.
   - Kører over eksisterende `sale_items` og opdaterer `mapped_commission`/`mapped_revenue`/`matched_pricing_rule_id` baseret på nuværende regler.
   - Triggers: kaldes fra UI (`PricingRuleEditor.tsx`, `MgTest.tsx`, `ProductMergeDialog.tsx`, `cancellations/*Tab.tsx`, `EditSalesRegistrations.tsx`, `SyncSingleSaleDialog.tsx`, `ApprovedTab.tsx`, `ApprovalQueueTab.tsx`).
   - Ingen cron — kun manuel.

#### Den kanoniske TM-engine: `matchPricingRule()`

`supabase/functions/integration-engine/core/sales.ts:105-254`. Algoritmen:

1. Hent regler for produktet → sorter `priority DESC` (intet sekundært nøglefelt).
2. For hver regel (i prioritetsorden):
   - Spring over hvis `is_active=false`.
   - **Datofilter**: spring over hvis `saleDate < effective_from` eller `saleDate >= effective_to` (`sales.ts:152-161`).
   - **Kampagne-filter** (`sales.ts:163-180`):
     - Ingen restriction → universal regel, fortsæt.
     - `mode='include'` → match kun hvis sale.campaign_mapping_id ∈ ids.
     - `mode='exclude'` → match kun hvis sale.campaign_mapping_id ∉ ids; hvis sale ingen campaign har, så regel matcher.
   - **Condition-filter** (`sales.ts:182-207`):
     - For hver `(key, value)` i `conditions`, find felt i `leadResultData` ∪ `rawPayload.data`.
     - String: exact match.
     - Numeric (`{ operator: 'gte'|'lte'|'gt'|'lt'|'between'|'in', value, value2?, values? }`): `evaluateNumericCondition()` (`sales.ts:16-29`).
     - Hvis alle conditions OK → MATCH.
   - **Empty-data fallback** (`sales.ts:209-226`):
     - Hvis betingelser fejler MEN `leadResultData` er tom OG kampagne-restriction matcher OG der findes betingelser → brug reglen ALLIGEVEL. Logges som "campaign fallback".
3. Hvis ingen regel matcher → fall back til `products.commission_dkk` × quantity.

#### TM data-enrichment før pricing

To stykker forretningslogik er hardkodet i `prepareSaleItems` (`sales.ts:300-405`):

- **Lønsikring product normalization** (`sales.ts:49-81`): Hvis `productId` matcher ét af 10 specifikke variant-id'er (Lønsikring Udvidet, Lønsikring Super, "under 5000", "Fagforening med lønsikring", osv.), omdøbes til standard Lønsikring-id `f9a8362f-3839-4247-961c-d5cd1e7cd37d` SÅ kun én pricing-regel skal vedligeholdes. Også navn-baseret: hvis titel matcher `/lønsikring/i`, normaliseres.
- **Dækningssum enrichment for ASE** (`sales.ts:317-336`): Hvis `Dækningssum` mangler og `A-kasse salg = 'Ja'`:
  - `Forening = 'Fagforening med lønsikring'` → sæt Dækningssum til `'6000'` (giver 800/1400 kr regel).
  - Ellers → sæt til `'0'` (giver 600/1200 kr regel).

Disse hardkodes både i `integration-engine` og `rematch-pricing-rules`. Drift hvis kun den ene opdateres.

### 3.2 FM (field marketing) — direkte UI-insert

Indgang: frontend → direkte insert i `sales` med `source='fieldmarketing'`.

Hvor det sker:
- `src/pages/vagt-flow/EditSalesRegistrations.tsx:433-456`: UI bygger objekter med `source='fieldmarketing'`, `integration_type='manual'`, og `raw_payload = { fm_seller_id, fm_location_id, fm_client_id, fm_product_name, fm_comment }`, derefter `supabase.from("sales").insert(newSales)`.
- RLS policy `"FM sellers can insert fieldmarketing sales"` (`docs/system-snapshot.md:349366-349371`) tillader dette.

Derefter to DB-triggere:

**BEFORE INSERT — `enrich_fm_sale()`** (migration `20260220122603`):
- Resolverer `agent_email` + `agent_name` fra `raw_payload.fm_seller_id` via `employee_master_data`.
- Resolverer `client_campaign_id`:
  1. Slå booking op via `fm_location_id` + dato (`booking.start_date ≤ sale_datetime ≤ booking.end_date`). Tager `booking.campaign_id`.
  2. Fallback: første `client_campaign` for `fm_client_id` (ORDER BY `created_at ASC`).
- Funktionen blev forenklret 2026-02-20 — fjernede smart-matching ("gade", "marked") fra version `20260310112819` til `20260220122603`. Tidsstemplerne i migration-filnavnene er ude af kronologisk orden (`20260310` skulle være efter `20260220`), så det er ikke 100% klart hvilken er live. **Senest-modificerede SQL-body i `docs/system-snapshot.md:357981` matcher dog `20260310112819`-versionen** med booking-fallback inklusive smart-matching. Konflikt mellem migrations-rækkefølge og snapshot-state.

**AFTER INSERT — `create_fm_sale_items()`** (migration `20260220122603`, body i `docs/system-snapshot.md:357909`):
- Idempotensvagt: skip hvis sale_items allerede findes.
- Hent produkt fra `products` ved case-insensitive trim på navn (`raw_payload.fm_product_name`), `is_active=true`, ORDER BY `priority DESC NULLS LAST, created_at DESC, id DESC`.
- **Hvis intet produkt findes** → log warning til `integration_logs`, skip. Sale_item oprettes IKKE.
- Slå `campaign_mapping_id` op via `client_campaign_id` → `adversus_campaign_mappings.id`.
- **Pricing-hierarki** (forskelligt fra TM):
  1. Kampagne-specifik regel: `WHERE product_id = v_product_id AND is_active=true AND v_campaign_mapping_id = ANY(campaign_mapping_ids)` ORDER BY `priority DESC NULLS LAST, created_at DESC, id DESC` LIMIT 1.
  2. Universal regel: `WHERE product_id = v_product_id AND is_active=true AND (campaign_mapping_ids IS NULL OR campaign_mapping_ids = '{}')`.
  3. Fall back: produkt-basispris.

**Forskelle mellem FM-trigger og TM-engine:**

| Feature | TM `matchPricingRule()` | FM `create_fm_sale_items()` |
|---|---|---|
| `priority DESC` | ✅ | ✅ |
| `effective_from`/`effective_to` | ✅ | ❌ |
| `campaign_match_mode='exclude'` | ✅ | ❌ |
| `conditions` jsonb | ✅ | ❌ |
| Empty-data campaign fallback | ✅ | n/a |
| `matched_pricing_rule_id` skrives | ✅ | ❌ |
| `display_name` fra rule | ❌ (kun base produktnavn) | ✅ via products.name (ikke rule.name) |
| Sekundær tie-breaker | nej | `created_at DESC, id DESC` |
| `is_immediate_payment` elevation | nej (kun rematch) | nej |

FM-triggeren har en sekundær tie-breaker, TM-engineren har ikke. To inkonsistente prioriterings-modeller.

**Healer — `heal_fm_missing_sale_items()`** (migration `20260322142011`):
- Backfill-funktion. Inserter sale_items for FM-sales der mangler dem.
- LEFT JOIN `product_pricing_rules` på `acm.id = ANY(ppr.campaign_mapping_ids)` (kampagne-specifik).
- ORDER BY `s.id, ppr.priority DESC NULLS LAST, p.priority DESC NULLS LAST, p.created_at DESC`.
- **Kalder IKKE universal-regel-fallback** som triggeren gør — kun kampagne-specifik regel eller produkt-basispris.
- Drift: hvis et produkt KUN har en universal regel og et FM-salg mangler sit sale_item, vil healer vælge basispris, mens triggeren ville have valgt regelpris.

**Engangsbackfill** (migration `20260219181949:208-258`): Engangs SQL-script der inserterede ~393 manglende sale_items med ORDER BY `priority DESC, created_at DESC, id DESC` på regler UDEN kampagne-filtrering overhovedet. Skygge-data fra denne backfill kan have brugt forkerte regler.

### 3.3 ASE straksbetaling — fjerde pricing-vej

`src/pages/ImmediatePaymentASE.tsx:60-107` og 110-150: Når en bruger trykker "tilføj straksbetaling" på et ASE-salg, kalder mutation:
1. SELECT `immediate_payment_commission_dkk`, `immediate_payment_revenue_dkk`, `name`, `use_rule_name_as_display` fra `product_pricing_rules` med `id = sale.matched_pricing_rule_id`.
2. UPDATE `sale_items` SET `is_immediate_payment=true`, `mapped_commission = rule.immediate_payment_commission_dkk`, `mapped_revenue = rule.immediate_payment_revenue_dkk`, `display_name = rule.name?:null`.

Cancellation mutation (linje 110+) gør omvendt: tilbage til `commission_dkk`/`revenue_dkk`.

**Kun nogle pricing-veje bruger den elevated rate:**
- Direkte UI-toggle (`ImmediatePaymentASE.tsx`): bruger elevated.
- Rematch (`rematch-pricing-rules/index.ts:713-721`): hvis `is_immediate_payment=true` OG `rule.allows_immediate_payment=true` → bruger elevated.
- Integration-engine (`integration-engine/core/sales.ts`): preserver `is_immediate_payment` flag på eksisterende rows, men når den genberegner pricing for en row bruger den IKKE elevated. Den genskaber pricing fra `matchPricingRule()` og overskriver — derefter restoreres `is_immediate_payment`, `mapped_commission`, `mapped_revenue` for rows der havde `is_immediate_payment=true` (`sales.ts:591-602`).

Logikken er korrekt på papiret, men kompleks: ved hver re-sync skal de "elevated" værdier bevares manuelt fordi pricing-engineren ikke selv kender straksbetaling.

---

## 4. Salgs-pipeline fra rå payload til endeligt commission-tal

### TM (Adversus, eksempel):

```
1. Dialer firer webhook → adversus-webhook/index.ts
   → sales row (med basispris-commission)
   → sale_items rows (basispris × qty)
   ↓
2. Næste cron (5 min senere) → integration-engine
   → pull /sessions + /leads → StandardSale[]
   → enrich med campaignMappings, productMappings
   → matchPricingRule() per sale_item (kampagne + conditions)
   → UPSERT sales ON CONFLICT(adversus_external_id) ← samme externalId-row
   → DELETE + INSERT sale_items (overskriver webhookens basispris)
   → matched_pricing_rule_id sættes
   ↓
3. (Hvis enrichment_status='pending')
   enrichment-healer cron → fetcher manglende leadResultData
   → opdaterer sales.raw_payload, enrichment_status='healed'
   ↓
4. (Hvis bruger redigerer regel eller efter rematch-knap)
   rematch-pricing-rules → genberegner mapped_commission/revenue
   for alle berørte sale_items
   ↓
5. (Hvis bruger toggler straksbetaling for ASE)
   ImmediatePaymentASE.tsx UPDATE sale_items direkte
```

### FM:

```
1. Sælger taster salg ind i UI → EditSalesRegistrations.tsx
   → INSERT INTO sales (source='fieldmarketing', raw_payload={fm_*})
   ↓
2. BEFORE INSERT trigger enrich_fm_sale()
   → resolverer agent_email + client_campaign_id
   ↓
3. AFTER INSERT trigger create_fm_sale_items()
   → matcher produkt på navn
   → bestemmer pricing (kampagne → universal → base)
   → INSERT INTO sale_items (uden matched_pricing_rule_id)
   ↓
4. (Hvis nogen kører heal_fm_missing_sale_items())
   → backfill for FM-sales der mangler sale_items
   ↓
5. (Hvis bruger redigerer eller kører rematch)
   rematch-pricing-rules → genberegner
```

---

## 5. Aggregering pr. sælger pr. periode

Tre niveauer afhængigt af hvilken side man kigger på.

### Niveau 1 — `get_sales_aggregates(p_start, p_end, p_team_id, p_employee_id, p_client_id)`
- SECURITY DEFINER (`docs/system-snapshot.md:358715-358742`).
- Returnerer `total_sales, total_commission, total_revenue` (én række).
- JOIN: `sales × sale_items × products`.
- **Ekskluderer FM**: `WHERE s.source != 'fieldmarketing'`.
- Filtrerer `validation_status != 'rejected'`.
- `total_sales` tæller kun hvor `products.counts_as_sale IS NOT FALSE`.
- Sælger-mapping: tager `eam.team_id` via `employee_agent_mapping × agents` joinet på `agents.email = lower(sales.agent_email)`.
- Brugt af `useSalesAggregates` (`src/hooks/useSalesAggregates.ts:36-162`).

### Niveau 2 — `get_sales_aggregates_v2(p_start, p_end, p_team_id, p_employee_id, p_client_id, p_group_by, p_agent_emails)`
- SECURITY DEFINER (`docs/system-snapshot.md:358744-358762`, fuld body i migration `20260225153645`).
- Returnerer rækker grupperet efter `p_group_by` (`'employee'`, `'date'`, `'both'`, `'none'`).
- **Inkluderer FM** (intet `s.source != 'fieldmarketing'`-filter).
- Bruger `(s.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date` for dato-gruppering — eneste sted i pricing-/aggregat-laget hvor timezone håndteres eksplicit.
- Dobbelt employee-fallback: `eam.employee_id` (via mapping) → `emd_fb.id` (via direct match på `work_email = agent_email`) → råt `lower(agent_email)`.
- Brugt af `useSalesAggregatesExtended` (`src/hooks/useSalesAggregatesExtended.ts:37-110`).

**Inkonsistens v1 vs v2:** Mathias har to RPC'er som tilsyneladende laver det samme, men:
- v1 ekskluderer FM, v2 inkluderer FM.
- v1 returnerer flade tal, v2 returnerer grupperet.
- v1 har enkel team-filtrering, v2 har dobbelt-fallback.

### Niveau 3 — Frontend fallback (klient-side aggregering)

Begge hooks har en `try { RPC } catch { fetch all rows og aggreger client-side }`. Fallback-paths har subtile forskelle fra RPC'erne:

- `useSalesAggregates` fallback (linje 79-91): `.neq("source", "fieldmarketing")` — konsistent med v1.
- `useSalesAggregatesExtended` fallback (linje 232-243): **intet `neq("source", "fieldmarketing")`** — konsistent med v2.

Dvs. både RPC og fallback inkluderer FM i v2-stien. OK.

Men: fallback bruger `agent_email` som employee-key direkte, mens RPC bruger `eam.employee_id`. Ved samme sælger med fl. agents (én pr. dialer) får RPC én række, fallback får én række pr. dialer-email. Dette er kun synligt hvis RPC fejler.

### Niveau 4 — Specielle aggregater

- `get_personal_daily_commission(employee_id, start_date, end_date)` (`docs/system-snapshot.md:358618-358639`): SUM(sale_items.mapped_commission) GROUP BY DATE(sale_datetime). Sælger-mapping via `employee_agent_mapping × agents`. **Filtrerer `status != 'rejected'`** (ikke `validation_status`). Bemærk: `sales.status` er en gammel kolonne — `validation_status` er den aktuelle. Mismatch.
- `get_sales_report_raw` (to versions, en med pagination, en uden): grupperer ikke, returnerer rå rækker. Inkluderer FM (intet source-filter).
- `get_sales_report_detailed`: grupperer på `employee + product`. Inkluderer FM.
- `get_client_sales_stats`, `get_distinct_agent_emails_for_client`, `get_distinct_sales_sources`, `get_sales_with_unknown_products`, `get_sales_without_items_count`.

### `useSellerSalariesCached` — løn-vejen
`src/hooks/useSellerSalariesCached.ts:48-150+`. Bygger oven på `useSalesAggregatesExtended` (linje 87-92, groupBy=`['employee']`). Får TM+FM samlet. Trækker `cancellation_queue` + `product_change_log` fra. Returnerer pr. medarbejder. Dette er hvad lønberegningen viser.

---

## 6. Triggers, RPC'er, healers, cron-jobs der rører beregningsmotoren

### Triggers (på `sales`)
- `enrich_fm_sale_trigger` BEFORE INSERT — kalder `enrich_fm_sale()` (kun FM).
- `trg_enrich_fm_sale` BEFORE INSERT — duplikat (samme funktion).
- `create_fm_sale_items_trigger` AFTER INSERT — kalder `create_fm_sale_items()` (kun FM).
- `trg_create_fm_sale_items` AFTER INSERT — duplikat.
- `trg_generate_sales_internal_reference` BEFORE INSERT — `MG-YYYYMM-NNNNN` (bruger `sales_reference_sequence`-tabellen).
- `validate_sales_email_trigger` BEFORE INSERT + UPDATE — validerer email.
- `update_sales_updated_at` BEFORE UPDATE.

**Ingen triggers på `sale_items`** (ud over PK + indexes).

### Triggers (på `product_pricing_rules`)
- `update_product_pricing_rules_updated_at` BEFORE UPDATE.
- **Ingen audit/history-trigger.** `pricing_rule_history` skrives manuelt fra UI.

### DB-funktioner i pricing-domænet
- `create_fm_sale_items()` — trigger, FM pricing.
- `enrich_fm_sale()` — trigger, FM enrichment.
- `heal_fm_missing_sale_items()` — manuel healer.
- `get_sales_aggregates(...)` — TM-only aggregat.
- `get_sales_aggregates_v2(...)` — TM+FM aggregat.
- `get_personal_daily_commission(...)` — pr. dag pr. employee.
- `get_sales_report_raw(...)`, `get_sales_report_detailed(...)` — rapporter.
- `get_sales_with_unknown_products()` — diagnostik.
- `get_sales_without_items_count(p_since)` — diagnostik.
- `get_client_sales_stats(p_start_date, p_end_date)` — pr. klient.
- `trigger_kpi_calculation()`, `trigger_kpi_incremental()` — KPI-cache (uden for scope).
- `can_view_sale_as_employee(_sale_id, _user_id)` — RLS-hjælper.

### Cron-jobs

Cron-jobs oprettes via `cron.schedule()` i migrations OG via `dialer_integrations.config.sync_schedule` (UI/RPC). Synlig liste:

- Per integration: `dialer-<8-char>-sync` hver 5. min, staggered (migration `20260218101500`).
- `enrichment-healer` — der findes UI-reference (`LiveCronStatus.tsx:35,44`) som "kendt job", men ingen migration opretter den. Skal være oprettet via psql eller dashboard. Kører periodisk og opdaterer `sales.raw_payload` for sales hvor `enrichment_status='pending'|'failed'`.
- KPI-cron, compliance-cron, mfl. — uden for scope.

**Ingen cron for rematch-pricing-rules.** Den kaldes manuelt fra UI (PricingRuleEditor onSave, MgTest knapper, cancellation-workflows, FM redigering).

### Edge functions involveret
- `adversus-webhook` (live webhook, simpel pricing).
- `integration-engine` (cron, kanonisk TM-pricing).
- `sync-adversus` (legacy, død i pricing-pipeline).
- `rematch-pricing-rules` (manuel rematch).
- `enrichment-healer` (cron, fetcher leadResultData så rematch kan finde flere matches).
- `tdc-opp-backfill` (uden for pricing-pipeline — handler om OPP-nr).

---

## 7. Konkrete inkonsistenser og død/skygge-kode

1. **Duplikate FM-triggers**: `enrich_fm_sale_trigger` + `trg_enrich_fm_sale`, og `create_fm_sale_items_trigger` + `trg_create_fm_sale_items`. Begge par kalder samme funktion. Anden kald er no-op pga. idempotensvagt, men hver insert kører funktionen to gange.

2. **`adversus-webhook` skriver `agent_id` til kolonne der ikke længere findes** (`index.ts:283`). Sales-tabellen i snapshot har ikke `agent_id`-kolonnen. Hvis insertet faktisk fejler, slettes denne fejlpaty fra logikken. Hvis Postgres ignorerer ukendte kolonner i visse setups, kan webhooken stadig fungere — men `agent_id` opdateres ALDRIG.

3. **`sync-adversus` death code**: Eneste writer til `commission_transactions`, bruger `agent_id` + `type` mens tabellen har `agent_name` + `transaction_type`. Ingen frontend kalder `sync-adversus`. Kan slettes.

4. **`commission_transactions`-tabel uden indhold**: 0 rækker (eller PII). Ingen readers i frontend. Død.

5. **`product_campaign_overrides`** (100 rækker, ikke 76 som CLAUDE.md siger): redigeres aktivt fra UI (`MgTest`-side), men læses IKKE af nogen pricing-vej. Nogen tror de overrider en kampagne-pris og oplever ingen effekt.

6. **`pricing_rule_history` mangler trigger**: UI-skrivning kun. SQL- og edge-mutationer på `product_pricing_rules` registreres ikke.

7. **FM-triggeren mangler flere features:**
   - `effective_from`/`effective_to` filtering.
   - `campaign_match_mode='exclude'` (kun include implicit).
   - `conditions` jsonb-matching.
   - `matched_pricing_rule_id` på sale_item.

8. **FM-trigger vs healer divergerer**: triggeren bruger universal-regel som fallback før basispris; healer bruger KUN kampagne-specifik regel før basispris (LEFT JOIN ppr ON `acm.id = ANY(ppr.campaign_mapping_ids)`).

9. **TM-webhook vs TM-engine divergerer**: webhook bruger kun basispris; integration-engine bruger fuld pricing. Salg lever maks 5 min med "forkert" pris før cron retter dem.

10. **Lønsikring-hardkodning duplikeres**: 10 variant-IDs + standard-ID + navn-regex står i både `integration-engine/core/sales.ts:49-81` og `rematch-pricing-rules/index.ts:14-25`. Hvis ny variant tilføjes, skal det to steder.

11. **Dækningssum-enrichment duplikeres**: `integration-engine/core/sales.ts:317-336` og `rematch-pricing-rules/index.ts:633-651`.

12. **ASE-key-normalisering kun i rematch**: `rematch-pricing-rules/index.ts:29-67` `ASE_KEY_MAP` (lowercase → korrekt casing) findes IKKE i integration-engine. Dvs. en ASE-sale med lowercase keys fra dialer matches korrekt ved rematch, men ikke ved initial sync.

13. **`agent_name`/`agent_email`/`agent_external_id` resolveres flere steder med forskellig fallback-rækkefølge** (kort sammenfattet — se CLAUDE.md §8 logik 1).

14. **v1 vs v2 aggregat-RPC**: v1 ekskluderer FM, v2 inkluderer. Forskellige hooks bruger forskellige. Et tal "total commission" kan være forskelligt afhængigt af hvilken hook der bruges.

15. **`get_personal_daily_commission` bruger `s.status != 'rejected'` mens andre RPC'er bruger `validation_status != 'rejected'`.** `sales.status` er gammel kolonne.

16. **Ingen tie-breaker på `priority` i nogen TM-vej**: `matchPricingRule` (integration-engine, rematch, fmPricing.ts, pricing-service.ts) sorterer kun `priority DESC`. Ved ens priority er udfaldet Postgres' fysiske row-order. FM-triggeren har `priority DESC NULLS LAST, created_at DESC, id DESC` som sekundær — den eneste vej der gør det.

17. **`fmPricing.ts`-helper i frontend matcher KUN på produktnavn (case-insensitive)** og rør IKKE `conditions` eller `effective_from/to`. Brug: noteret i `useDashboardSalesData.ts`, `useKpiTest.ts`. Disse rapporter ser potentielt andre tal end DB-aggregaterne. Bygges på "deprecated path"-noter.

18. **Backfill-script i migration `20260219181949:208-258` brugte regler UDEN kampagne-filtrering**. Sale_items skabt af det script kan have forkerte regler tilknyttet. Engangs, men efterlader skygge-data.

19. **Frontend duplikerer pricing-logik**: `DailyRevenueChart.tsx`, `RevenueByClient.tsx`, `DailyReports.tsx`, `useDashboardSalesData.ts`, `useKpiTest.ts` har egne implementationer af "find prisregel for produkt+kampagne". Hver kan drifte fra DB-engineren.

20. **Migration-rækkefølge ude af sync**: `20260310112819` (mere komplet `enrich_fm_sale`) ligger fil-navngivnings-mæssigt efter `20260220122603` (forenklet version), men system-snapshot.md viser den mere komplette version live. Det er ikke 100% klart hvilken er aktuel uden direkte DB-tjek.

21. **`enrichment-healer` er en cron-job uden migration**. Findes kun i prod via dashboard/psql.

---

## 8. Hvor `matched_pricing_rule_id` faktisk er sat

Verificeret mod prod-sample (`docs/system-snapshot.md:349250-349303`): begge viste sale_items har `matched_pricing_rule_id: null` selv om de har commission/revenue ≠ 0.

Sandsynlige forklaringer:
- Sale_items fra **webhook** (ingen rule lookup) → mapped fra base products.
- Sale_items fra **integration-engine** før rematch er kørt og ingen TM-regel matchede → null.
- Sale_items fra **`create_fm_sale_items`-trigger** (skriver aldrig matched_pricing_rule_id).
- Sale_items fra **backfill-script 20260219181949** sætter det dog (`migration:218`).

Konkret konsekvens: man kan IKKE pålideligt sige "hvilken regel gav dette salg sin pris?" ved at læse `matched_pricing_rule_id`. Det er informativt når det er sat, men ikke en garanti.

---

## 9. Mappinger og hjælpetabeller i pipelinen

- `adversus_campaign_mappings` (samme tabel håndterer alle dialer-typer trods navnet): `adversus_campaign_id` (text, dialer-side) ↔ `client_campaign_id` (Stork-side) ↔ `id` (intern Stork-uuid). Det er DEN UUID som `product_pricing_rules.campaign_mapping_ids` peger på. Webhook + integration-engine sikrer at der altid findes en (måske unmappet) række via `ensureCampaignMappings` (`integration-engine/core/sales.ts:256-298`).

- `adversus_product_mappings`: dialer-produkt-id eller -navn ↔ Stork-`product_id`. Webhook upserter denne ved produktnavn-fallback (`adversus-webhook/index.ts:381-401`). Integration-engine bruger `productMapByExtId` + `productMapByName` (`sales.ts:724-732`).

- `dialer_integrations`: cred + config pr. dialer. `is_active=true` styrer cron. `config.sync_schedule` lagrer cron-string. `config.sync_days` for ASE (sat til 3 i `20260218101500`).

- `dialer_calls`, `dialer_sessions`, `adversus_events`: rådata-spor.

- `agents`: én række pr. (dialer × user). Stork-id. FK til `employee_agent_mapping`.

- `employee_agent_mapping`: many-to-many `(employee_id, agent_id)`. **Uden FK-constraints** (sml. CLAUDE.md §8 logik 1).

- `client_campaigns`: kampagner pr. klient i Stork.

---

## 10. Hvad ligger uden for beregningsmotoren (men rører den)

For at trække grænsen klart:

**INDEN FOR (det Mathias spurgte om):**
- Pricing: `product_pricing_rules`, `products`, `adversus_campaign_mappings`, `adversus_product_mappings`.
- Engines: `integration-engine`, `adversus-webhook`, `create_fm_sale_items`-trigger, `rematch-pricing-rules`, `heal_fm_missing_sale_items`, `ImmediatePaymentASE.tsx`.
- Aggregering: `get_sales_aggregates`, `get_sales_aggregates_v2`, `get_personal_daily_commission`, `useSalesAggregates`, `useSalesAggregatesExtended`.

**UDEN FOR (separat lag):**
- Lønberegning: `useSellerSalariesCached` (bygger på aggregat), `salary_*`-tabeller, `booking_diet`, `daily_bonus_payouts`, `personnel_salaries`, `useAssistantHoursCalculation`, `useStaffHoursCalculation`, vacation-pay.
- Annulleringsmatching: `cancellation_queue`, `cancellation_product_mappings`, `cancellation_product_conditions`, `product_change_log`, hele `cancellations/*`-domænet.
- KPI-cache og TV-boards: `kpi_*`-tabeller, `calculate-kpi-incremental`, `dashboard_kpis`.
- Bogføring (Revenue Match): `economic_invoices`, `economic-webhook`, `sync-economic-invoices`.

**RØRER BÅDE OG**:
- `cancellation_queue.status='approved'` udløser ikke automatisk rematch — annullering nedskriver commission via `useSellerSalariesCached` på rapport-tidspunktet, ikke i `sale_items.mapped_commission`. `is_cancelled` og `cancelled_quantity` på `sale_items` er nye felter — verificering af om de bliver brugt af pricing/aggregat er ikke gennemgået her.
- `pricing_rule_history.change_type='pre-rematch-snapshot-2026-04-28'` viser at der har været en stor rematch 28. april 2026. Hver gang regler ændres og rematch køres, vil sale_items få nye `mapped_commission`-værdier — også for salg fra tidligere perioder. Periode-låsning eksisterer IKKE i DB (`pay_periods`-tabel findes IKKE i 1.0-snapshot — den findes kun i Stork 2.0).

---

## 11. Pricing-konfigurations-state pr. snapshot

- `products`: 444 rækker. 444 produkter inklusive merged og inaktive (snapshot viser et inaktivt + merged produkt).
- `product_pricing_rules`: 280 aktive + inaktive regler. Sample-priority var 10 og 0. CLAUDE.md flagger at "Relatel og Eesy har bevidst ingen `effective_from`" — det er en konvention, ikke en DB-constraint.
- `product_campaign_overrides`: 100 rækker — alle ineffektive.
- `pricing_rule_history`: ukendt rækketal, mindst 2 rækker (sample). Indeholder mindst `pre-rematch-snapshot-2026-04-28`-batch.
- `product_price_history`: 172 rækker. Bruges af UI til at vise basispris-historik.

---

## 12. Sammenfattende fakta-tabel

| Aspekt | TM (integration-engine) | TM (adversus-webhook) | FM (create_fm_sale_items) | Rematch | Healer | ASE straksbet. |
|---|---|---|---|---|---|---|
| **Aktiv** | ✅ kanonisk | ✅ live første hit | ✅ trigger | ✅ manuel | ✅ on-demand | ✅ UI |
| **Skriver `matched_pricing_rule_id`** | ✅ | ❌ | ❌ | ✅ | ❌ | nej (bevarer) |
| **Bruger `product_pricing_rules`** | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ (læser) |
| **Kampagne `include`** | ✅ | ❌ | ✅ | ✅ | ✅ | n/a |
| **Kampagne `exclude`** | ✅ | ❌ | ❌ | ✅ | ❌ | n/a |
| **`effective_from`/`to`** | ✅ | ❌ | ❌ | ✅ | ❌ | n/a |
| **`conditions` jsonb** | ✅ | ❌ | ❌ | ✅ | ❌ | n/a |
| **Universal-regel fallback** | ✅ | ❌ | ✅ | ✅ | ❌ | n/a |
| **Base products fallback** | ✅ | ✅ | ✅ | ✅ | ✅ | n/a |
| **`immediate_payment_*` elevation** | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Tie-breaker udover priority** | ❌ | n/a | ✅ created_at, id | ❌ | ✅ priority + created_at | n/a |
| **Lønsikring-normalisering** | ✅ | ❌ | ❌ | ✅ | ❌ | n/a |
| **Dækningssum-enrichment** | ✅ | ❌ | ❌ | ✅ | ❌ | n/a |
| **ASE key-normalisering** | ❌ | ❌ | ❌ | ✅ | ❌ | n/a |

(Tabellen viser at REMATCH er den mest komplette engine; alle andre veje har huller.)

---

## 13. Hvor sandheden om "pris pr. salg" reelt lever

Følgende rangordning fra mest til mindst pålidelig:

1. **`sale_items.mapped_commission` / `mapped_revenue`** — den eneste sandhed for hver linje. Hvad der end er sket, er disse de tal lønnen bruger.
2. **`matched_pricing_rule_id`** — informativt når sat, men NULL er ikke samme som "ingen regel matchede". Kan også betyde "skrevet af webhook/FM-trigger/healer som ikke sætter feltet".
3. **`get_sales_aggregates_v2(...)`** og dens fallback — TM+FM samlet.
4. **`get_sales_aggregates(...)`** — kun TM.
5. **Frontend-aggregater i Dashboards (`DailyRevenueChart`, `RevenueByClient`, `DailyReports`, `useKpiTest`)** — egen logik, kan drifte.
6. **`commission_transactions`** — ingen pålidelig data.

---

## 14. Tidsstempler i pricing-pipelinen

- `sales.sale_datetime` er primær. Bruges af pricing til `effective_from/to`-filter (TM-engine + rematch).
- `sale_items.created_at` er teknisk metadata. Bruges som sekundær tie-breaker i FM-trigger og healer.
- `product_pricing_rules.effective_from/to` er pr. dag (date, ikke timestamptz). Sammenligning sker via `saleDate.toISOString().split('T')[0]` (`sales.ts:138`, `rematch:220`) — dvs. UTC-konvertering først, så date. Et salg kl. 23:30 dansk tid bliver til UTC-dagen før i sammenligningen.
- `get_sales_aggregates_v2` bruger `(sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date` — modsat retning. Tæller salget på dansk dato.

Konsekvens: et salg kl. 23:30 lokaltid kan rapporteres på "i dag" i v2-aggregat OG samtidig falde uden for en regels `effective_from='i morgen'` i pricing-engineren. Ingen drift mellem mapped_commission og rapporteringen — men en kantcase ved rolloverdage hvor en regel skifter pris.

---

## 15. Hvad jeg ikke har verificeret empirisk

- **Antallet af sale_items hvor `matched_pricing_rule_id IS NOT NULL`** vs NULL i prod (har kun set 2-row sample).
- **Om duplikate FM-triggers faktisk kører to gange** eller om Postgres dedup'er — testet ikke i live DB (greenfield 2.0-projekt).
- **Hvorvidt `agent_id`-kolonnen findes i live `sales`-tabel** i 1.0 — kun snapshot baseret.
- **Faktisk cron-state**: `cron.job`-tabellen ikke tilgængelig i Stork 2.0 MCP. Cron-skemaer rekonstrueret fra migrations.
- **Om `enrichment-healer` faktisk kører** — fundet kun via UI-reference, ingen migration.
- **Migration-rækkefølge for FM-trigger**: senere file-navn ≠ senere modificeret state. Snapshot-body matcher noget mellem de to versioner.

---

## 16. Konklusion (faktuel)

Beregningsmotoren har:
- **1 datamodel** (sale_items.mapped_commission/revenue) som sandheden.
- **2 fundamentalt forskellige pricing-engines** (TM vs FM) implementeret i hhv. TypeScript edge function og PL/pgSQL trigger.
- **5+ skrive-veje** der opdaterer mapped_commission/revenue (TM webhook, TM integration-engine, FM trigger, FM healer, rematch, ASE straksbet., engangs-backfill).
- **2 aggregat-RPC'er** med forskellig FM-håndtering.
- **2 sæt frontend-fallbacks** der ikke matcher RPC'erne præcist.
- **5+ steder hvor samme forretningslogik (Lønsikring, Dækningssum, ASE-keys, kampagne-matching) duplikeres**.
- **0 cron-jobs for rematch eller healers** — kun manuel udløsning.

Pricing virker. Men ingen enkelt fil indeholder hele sandheden om hvordan et salg får sin pris. Den kanoniske implementation findes i `rematch-pricing-rules/index.ts` (mest komplet), men den kører ikke automatisk. Hverdagspriserne sættes af `integration-engine/core/sales.ts` (TM) eller `create_fm_sale_items()` (FM), og de to har forskellige features.

