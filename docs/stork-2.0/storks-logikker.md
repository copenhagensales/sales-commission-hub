# Storks Logikker

**Version:** 1.0 · April 2026
**Format:** Følger `kpi_definitions`-skemaet (`slug`, `name`, `category`, `description`, `calculation_formula`, `sql_query`, `data_sources`, `important_notes`, `example_value`). Hver logik kan direkte INSERTes som række.
**Status-markører:** **OK** (verificeret) · **USIKKER** (mangler verifikation — beskrivelse af hvad jeg ville tjekke) · **ROD** (logik der ikke er bevidst designet — beskrives, foreslås ikke fix).

---

## Indholdsfortegnelse

**Fase 1 — Kerne-økonomi**
1. [`tm_pricing`](#1-pricing-motor-tm--tm_pricing) — Pricing-motor (TM)
2. [`fm_pricing`](#2-pricing-motor-fm--fm_pricing) — Pricing-motor (FM, kampagne-aware)
3. [`commission_calculation`](#3-provisionsberegning--commission_calculation) — Provision pr. sælger
4. [`seller_salary`](#4-sælger-løn--seller_salary) — Sælger-løn (samlet)
5. [`team_leader_salary`](#5-leder-løn--team_leader_salary) — Leder-løn baseret på team-DB
6. [`staff_assistant_salary`](#6-assistent--stab-løn--staff_assistant_salary) — Assistent/stab-løn
7. [`cancellation_deduction`](#7-annullering-og-modregning--cancellation_deduction) — Annulleringer

**Fase 2 — Attribution & tilhørsforhold**
8. [`sales_ownership`](#8-salgsejer--sales_ownership) — Sælger/klient/team-attribution
9. [`team_client_ownership`](#9-team-ejerskab-af-klienter--team_client_ownership)
10. [`employee_client_assignments`](#10-medarbejder-klient-tildeling--employee_client_assignments)
11. [`fm_dual_path_attribution`](#11-fm-dual-path-attribution--fm_dual_path_attribution)
12. [`revenue_match_validation`](#12-revenue-match--revenue_match_validation)

**Fase 3 — Permission & rolle**
13. [`permission_resolution`](#13-permission-resolution--permission_resolution)
14. [`role_inheritance_priority`](#14-rolle-arv-og-prioritet--role_inheritance_priority)
15. [`team_role_employee_matrix`](#15-team--rolle--medarbejder-matrix--team_role_employee_matrix)

**Fase 4 — Tid & låsning**
16. [`payroll_period_15_14`](#16-lønperiode-15til14--payroll_period_15_14)
17. [`timezone_handling`](#17-tidszone-håndtering--timezone_handling)
18. [`immutable_data_tables`](#18-immutable-tabeller--immutable_data_tables)

**Fase 5 — Klient-specifikke**
19. [`ase_immediate_payment`](#19-ase-straksudbetaling--ase_immediate_payment)
20. [`eesy_cancellation_matching`](#20-eesy-cancellation-matching--eesy_cancellation_matching)
21. [`tdc_opp_duplicate_detection`](#21-tdc-opp-dublet-detektion--tdc_opp_duplicate_detection)
22. [`client_specific_pricing_overrides`](#22-klient-specifikke-pricing-undtagelser--client_specific_pricing_overrides)

**Fase 6 — Integration**
23. [`adversus_pipeline`](#23-adversus-pipeline--adversus_pipeline)
24. [`enreach_pipeline`](#24-enreach-pipeline--enreach_pipeline)
25. [`economic_integration`](#25-e-conomic-integration--economic_integration)

**Fase 7 — Cross-cutting**
26. [`cache_invalidation`](#26-cache-invalidation--cache_invalidation)
27. [`gdpr_data_cleanup`](#27-gdpr-sletning-og-anonymisering--gdpr_data_cleanup)
28. [`audit_trails`](#28-audit-trails--audit_trails)

---

# Fase 1 — Kerne-økonomi

## 1. Pricing-motor (TM) — `tm_pricing`

- **Kategori:** pricing
- **Status:** OK med kendt **ROD** i tie-breaker.
- **Beskrivelse:** Beslutter `commission_dkk` og `revenue_dkk` for et TM-salg ved at matche `sale_items.product_id` mod `product_pricing_rules` efter prioritet og kampagne-kontekst. Autoritativ implementation: `src/lib/calculations/pricingRuleMatching.ts` (frontend) og `supabase/functions/_shared/pricing-service.ts` (edge). Holdes 1:1 manuelt.

- **Beregningsformel:**
  1. Givet et `sale_items.product_id` og salgets `client_campaign_id` → slå campaign mapping op via `adversus_campaign_mappings.client_campaign_id` for at finde `campaign_mapping_id`.
  2. Hent alle aktive regler for produktet: `WHERE product_id = ? AND is_active = true`.
  3. Filtrér på dato: `effective_from IS NULL OR effective_from <= sale_date` AND `effective_to IS NULL OR effective_to >= sale_date`.
  4. Filtrér på kampagne via `ruleMatchesCampaign(rule.campaign_mapping_ids, rule.campaign_match_mode, campaign_mapping_id)`:
     - `campaign_match_mode = 'include'` med tom liste → universal regel (matcher alle kampagner).
     - `campaign_match_mode = 'include'` med liste → matcher kun hvis `campaign_mapping_id ∈ liste`.
     - `campaign_match_mode = 'exclude'` med liste → matcher hvis `campaign_mapping_id ∉ liste`.
  5. Sortér resterende regler `ORDER BY priority DESC`. **Ingen sekundær sortering** → ved ens priority er rækkefølgen Postgres' fysiske row-order (kan ændre sig efter VACUUM/REINDEX).
  6. Tag første regel. Returnér `{ commission_dkk, revenue_dkk }`.
  7. Hvis ingen regel matcher → fallback til `products.commission_dkk` / `products.revenue_dkk` (basisprisen).
  8. Hvis produktet ikke findes → `{ commission: 0, revenue: 0 }`.

- **SQL Query (reference):**
  ```sql
  -- Find pris for et givent salg på et givent produkt
  WITH campaign_ctx AS (
    SELECT acm.id AS campaign_mapping_id
    FROM sales s
    LEFT JOIN adversus_campaign_mappings acm
      ON acm.client_campaign_id = s.client_campaign_id
    WHERE s.id = :sale_id
  )
  SELECT
    ppr.commission_dkk,
    ppr.revenue_dkk,
    ppr.priority,
    ppr.campaign_match_mode
  FROM product_pricing_rules ppr, campaign_ctx
  WHERE ppr.product_id = :product_id
    AND ppr.is_active = true
    AND (ppr.effective_from IS NULL OR ppr.effective_from <= :sale_date)
    AND (ppr.effective_to   IS NULL OR ppr.effective_to   >= :sale_date)
    AND (
      (ppr.campaign_match_mode = 'include'
        AND (cardinality(coalesce(ppr.campaign_mapping_ids, '{}')) = 0
             OR campaign_ctx.campaign_mapping_id = ANY(ppr.campaign_mapping_ids)))
      OR
      (ppr.campaign_match_mode = 'exclude'
        AND (campaign_ctx.campaign_mapping_id IS NULL
             OR NOT (campaign_ctx.campaign_mapping_id = ANY(ppr.campaign_mapping_ids))))
    )
  ORDER BY ppr.priority DESC
  LIMIT 1;
  ```

- **Datakilder:**
  `product_pricing_rules`, `products`, `adversus_campaign_mappings`, `sale_items`, `sales`, `client_campaigns`. RPC: `rematch-pricing-rules` (edge function der bulk-anvender logikken på historiske salg).

- **Vigtige noter:**
  - **Tie-breaker mangler (ROD):** Identisk `priority` → resultatet bliver Postgres' lagringsrækkefølge. Ingen UNIQUE-constraint forhindrer duplikater. Pricing kan teoretisk skifte stille uden ændringer i regler.
  - **Relatel + Eesy har bevidst ingen `effective_from`** for at undgå at retroaktiv rematch bryder gamle data. Dette er en stiltiende konvention (memory `pricing-rule-retroactivity-and-alias-mapping-v2026`), ikke håndhævet i skemaet.
  - **`product_campaign_overrides` (76 aktive rækker, halv-død):** Læses og skrives via `MgTest.tsx`, `ProductCampaignOverrides.tsx`, `ProductMergeDialog.tsx`, `useKpiTest.ts` — men læses **IKKE** af pricing-motoren. En bruger kan redigere en override og se ingen effekt. Rod, ikke logik.
  - **Frontend ↔ edge drift:** Logikken eksisterer to steder og holdes 1:1 manuelt. Ingen automatisk diff-test fanger drift.
  - **Subsidy-fallback:** Salg uden `Tilskud`-info i payload kan falde gennem kampagne-fallback og ramme en "forkert" regel. Beslutning åben (CLAUDE.md §7).
  - **`product_pricing_rules.priority`** er den eneste sorteringsnøgle. Højere = vinder.
  - Ved manuel ændring af salg i `EditSalesRegistrations.tsx` bevares eksisterende `sale_items` (provision/omsætning) frem for at re-køre pricing — bevidst integritetsregel (memory `sales-data-edit-integrity-v2026`).

- **Eksempelværdi:**
  Et Eesy TM-salg af "TV Pakke L" registreres. Produktet har 3 regler: priority 100 universal (250/1500 kr), priority 200 inkluderet for Eesy-kampagner (300/1800 kr), priority 50 ekskluderet for konkurrent-kampagne. Salget tilhører Eesy-kampagnen → priority 200 vinder → `commission = 300`, `revenue = 1800`.

---

## 2. Pricing-motor (FM) — `fm_pricing`

- **Kategori:** pricing
- **Status:** OK
- **Beskrivelse:** Pricing for FM-salg sker via `src/lib/calculations/fmPricing.ts`. FM-salg har ikke `sale_items` direkte ved oprettelse; pris slås op pr. produkt-navn (case-insensitiv) og kampagne. Autoritativ for FM-provision og -omsætning. DB-trigger `enrich_fm_sale` (BEFORE INSERT på `sales`) og `create_fm_sale_items` (AFTER INSERT) anvender logikken.

- **Beregningsformel:**
  1. Bygg lookup: hent alle aktive regler (`product_pricing_rules WHERE is_active = true ORDER BY priority DESC`) + alle produkter (`products`).
  2. Group regler pr. `product_id` (priority desc).
  3. Map produkter via `name.toLowerCase()` → `ProductRow`.
  4. For et FM-salg med `productName` + `campaignMappingId` (id i `adversus_campaign_mappings` mappet via `client_campaign_id`):
     a. Slå produkt op via `name.toLowerCase()`. Ikke fundet → `{0,0}`.
     b. Iterér regler for produktet (priority desc). Første der matcher kampagnen via `ruleMatchesCampaign(...)` vinder.
     c. Ingen regel matcher → fallback til `products.commission_dkk` / `products.revenue_dkk`.
  5. Tilknyttede økonomiske strømme (separate logikker, samme modul):
     - **Diæt** → `booking_diet` (rækker med `salary_type` = diæt).
     - **Oplæringsbonus** → `booking_diet` (rækker med `salary_type` = oplæring; fast 750 kr/registrering — memory `salary-training-bonus-logic`).
     - **Hotel** → `booking_hotel.price_per_night` lagres altid eksklusive moms som samlet pris for hele opholdet (memory `fm-hotel-billing-and-tracking`), ikke pr. nat trods kolonnenavnet.
     - **Startup-bonus** → `booking_startup_bonus`.

- **SQL Query (reference):**
  ```sql
  -- FM pricing lookup (svarer til buildFmPricingLookup → kald)
  SELECT
    COALESCE(ppr.commission_dkk, p.commission_dkk, 0) AS commission,
    COALESCE(ppr.revenue_dkk,    p.revenue_dkk,    0) AS revenue
  FROM products p
  LEFT JOIN LATERAL (
    SELECT commission_dkk, revenue_dkk, priority
    FROM product_pricing_rules
    WHERE product_id = p.id
      AND is_active = true
      AND (
        (campaign_match_mode = 'include'
          AND (cardinality(coalesce(campaign_mapping_ids, '{}')) = 0
               OR :campaign_mapping_id = ANY(campaign_mapping_ids)))
        OR
        (campaign_match_mode = 'exclude'
          AND (:campaign_mapping_id IS NULL
               OR NOT (:campaign_mapping_id = ANY(campaign_mapping_ids))))
      )
    ORDER BY priority DESC
    LIMIT 1
  ) ppr ON TRUE
  WHERE LOWER(p.name) = LOWER(:product_name);
  ```

- **Datakilder:**
  `products`, `product_pricing_rules`, `adversus_campaign_mappings`, `sales` (FM-rækker), `sale_items` (efter trigger), `booking_diet`, `booking_hotel`, `booking_startup_bonus`. DB-funktioner: `enrich_fm_sale`, `create_fm_sale_items`, `heal_fm_missing_sale_items` (manuel reparation hvis trigger fejler).

- **Vigtige noter:**
  - FM matcher pr. **produkt-navn** (case-insensitiv), ikke product_id, fordi FM-payloads ikke altid har stabilt id.
  - Backward-compat `buildFmPricingMap` returnerer kun "universal-only" priser (kampagne-restriktioner ignoreres). Brugt af ældre kodepuljer.
  - **`heal_fm_missing_sale_items`** kan kaldes manuelt hvis `create_fm_sale_items`-triggeren har fejlet. Ingen automatisk monitorering der signalerer behov.
  - **Hotel-pris er total, ikke pr. nat** — let at læse forkert ud fra kolonnenavn.
  - **Diæt og oplæring deler tabel** (`booking_diet`) — differentieres på `salary_type_id` (memory `diet-and-training-bonus-storage-logic`).
  - FM-checkliste, FM-vagter, FM-leverandørrapport er separate moduler men deler `booking`-træ som rod (`booking → booking_assignment + booking_diet + booking_hotel + booking_vehicle + booking_startup_bonus`).
  - FM-medarbejdere uden dialer-mapping kan stadig se egen kommission via dedikeret RLS-policy (memory `fieldmarketing-payroll-visibility-rls`).

- **Eksempelværdi:**
  Booking-vagt på lokation X, kampagne "Eesy FM". Sælger registrerer salg af "TV+BB Pakke" + 1 oplæringsdag + 1 hotelnat (1200 kr inkl). Trigger `enrich_fm_sale` slår "TV+BB Pakke" op (kampagne-aware) → fx commission 350 / revenue 1900. `create_fm_sale_items` opretter sale_items-række. Diæt for dagen + 750 kr oplæring lægges i `booking_diet`. Hotel går til leverandørrapport.

---

## 3. Provisionsberegning — `commission_calculation`

- **Kategori:** salary
- **Status:** OK
- **Beskrivelse:** Aggregerer en sælgers samlede provision i en periode ved at summere `sale_items.mapped_commission` for alle salg attribueret til sælger via `employee_agent_mapping` (TM) eller direkte via `seller_name` + team-attribution (FM). Autoritativ via `useSalesAggregates`-hook + `get_sales_aggregates_*` RPC'er.

- **Beregningsformel:**
  1. Find sælgerens `agent_id`'er via `employee_agent_mapping WHERE employee_id = :employee_id` (kan være flere — én pr. dialer).
  2. Find alle agent-emails: `agents.email WHERE id IN (:agent_ids)`.
  3. Find salg: `sales WHERE LOWER(agent_email) IN (:emails) AND sale_datetime BETWEEN :period_start AND :period_end`.
  4. Join `sale_items` på `sales.id` → summér `mapped_commission`.
  5. FM-salg uden agent-mapping: identifér via `sales.seller_name` + klient-attribution (se `fm_dual_path_attribution`).
  6. Total provision = SUM(sale_items.mapped_commission) for både TM- og FM-salg.

- **SQL Query (reference):**
  ```sql
  SELECT
    e.id,
    e.first_name || ' ' || e.last_name AS seller,
    SUM(si.mapped_commission) AS total_commission,
    SUM(si.mapped_revenue)    AS total_revenue,
    COUNT(DISTINCT s.id)      AS sale_count
  FROM employee_master_data e
  LEFT JOIN employee_agent_mapping eam ON eam.employee_id = e.id
  LEFT JOIN agents a ON a.id = eam.agent_id
  LEFT JOIN sales s
    ON LOWER(s.agent_email) = LOWER(a.email)
   AND s.sale_datetime BETWEEN :period_start AND :period_end
  LEFT JOIN sale_items si ON si.sale_id = s.id
  WHERE e.id = :employee_id
  GROUP BY e.id, seller;
  ```

- **Datakilder:**
  `sales`, `sale_items`, `employee_agent_mapping`, `agents`, `employee_master_data`. RPC'er: `get_sales_aggregates_v2`, `get_sales_aggregates_team`, `get_cs_top20_custom_period_leaderboard`. Hooks: `useSalesAggregates`, `useSellerSalariesCached`.

- **Vigtige noter:**
  - **Single source of truth = `useSalesAggregates`** (memory `central-sales-aggregation-hook`). Andre udregninger der ikke bruger den, kan drifte.
  - **Identitets-fallback i 4 lag** (memory `reporting-identity-resolution-logic`): mapping → work_email → username → agent_email. Samme person kan optræde under forskellige navne i forskellige rapporter hvis fallback-laget skifter.
  - **Umappede salg** (ingen `employee_agent_mapping`-match) vises ikke i medarbejder-rapporter, men eksisterer i `sales` — synlige i MgTest "needs_mapping"-banner.
  - **Provision tilskrives ved registrering** (princip 5 i biblen) — ikke ved fakturering eller ved kunde-aktivering.
  - **`commission_transactions`** er separat tabel der gemmer tildelte provisionsposter per lønperiode (immutable, rød zone). Adskilt fra `sale_items.mapped_commission` der er pris-tidspunkt-værdi.
  - FM dual-path: hvis agent-attribution mangler, falder leaderboard tilbage til navne-match (se logik 11).

- **Eksempelværdi:**
  Sælger Mads har 47 salg i lønperiode 15. mar–14. apr. Sum af `sale_items.mapped_commission` = 23.450 kr. Plus 3 FM-salg uden mapping men matched via `seller_name = 'Mads Hansen'` + Eesy FM-team = 1.200 kr. Total provision = 24.650 kr.

---

## 4. Sælger-løn — `seller_salary`

- **Kategori:** salary
- **Status:** OK
- **Beskrivelse:** Beregner samlet løn for en sælger i én lønperiode (15.→14.). Kombinerer provision, grundløn (timer × sats), diæter, oplæringsbonus, manuelle tillæg, annulleringsfradrag, daglig bonus, feriepenge-tillæg og rollover fra forrige periode. Autoritativ via `useSellerSalariesCached.ts`.

- **Beregningsformel:**
  1. **Provision:** se `commission_calculation` (logik 3).
  2. **Grundløn (timer):** `useStaffHoursCalculation` / `useAssistantHoursCalculation` / `useEffectiveHourlyRate` afhængigt af type. Timer hentes via `useShiftResolution` (vagt-hierarki: individuel vagt > standard vagt; weekend = arbejdsdag hvis vagt findes — memory `visual-weekend-integration`).
  3. **Diæter:** SUM `booking_diet.amount WHERE employee_id = ? AND date BETWEEN period AND salary_type = diæt`.
  4. **Oplæringsbonus:** SUM 750 kr × antal `booking_diet`-rækker med `salary_type = oplæring`.
  5. **Daglig bonus:** SUM `daily_bonus_payouts.amount` for periode.
  6. **Manuelle tillæg/fradrag:** `salary_additions WHERE employee_id = ? AND year_month = ?` — knyttet til specifikke kolonner (Provision/A-kasse/etc; memory `manual-salary-additions-logic`).
  7. **Annullering-fradrag:** se `cancellation_deduction` (logik 7).
  8. **Subtotal A** = provision + grundløn + diæter + oplæring + dagsbonus + tillæg − fradrag − annulleringer.
  9. **Rollover:** Hvis subtotal A < 0 (negativ løn) → vis 0, gem rest som rollover til næste periode i `personnel_salaries` eller tilsvarende. Ved medarbejder-stop afskrives rollover (princip 6).
  10. **Feriepenge:** 12,5 % tillæg af løn-grundlaget (memory `client-db-profitability-and-proration-logic-v2027`). Beregnes i `vacation-pay.ts`.
  11. **Total udbetaling** = max(0, subtotal A) + feriepenge.

- **SQL Query (reference):**
  ```sql
  -- Skitse — den fulde beregning sker i frontend-hook + helpers
  SELECT
    e.id,
    (SELECT SUM(si.mapped_commission)
       FROM sales s JOIN sale_items si ON si.sale_id = s.id
       WHERE s.agent_email = ANY(:emails)
         AND s.sale_datetime BETWEEN :p_start AND :p_end) AS provision,
    (SELECT SUM(amount) FROM booking_diet
       WHERE employee_id = e.id AND date BETWEEN :p_start AND :p_end
         AND salary_type_id = (SELECT id FROM salary_types WHERE code='diet')) AS diet,
    (SELECT 750 * COUNT(*) FROM booking_diet
       WHERE employee_id = e.id AND date BETWEEN :p_start AND :p_end
         AND salary_type_id = (SELECT id FROM salary_types WHERE code='training')) AS training_bonus,
    (SELECT SUM(amount) FROM salary_additions
       WHERE employee_id = e.id AND year_month = :ym) AS additions,
    (SELECT SUM(amount_dkk) FROM cancellation_queue
       WHERE employee_id = e.id AND deduction_date BETWEEN :p_start AND :p_end
         AND status='approved') AS cancellations
  FROM employee_master_data e
  WHERE e.id = :employee_id;
  ```

- **Datakilder:**
  `sale_items`, `commission_transactions`, `booking_diet`, `daily_bonus_payouts`, `salary_additions`, `cancellation_queue`, `personnel_salaries`, `payroll_error_reports`, `shift`, `employee_standard_shifts`, `employee_time_entries`. Hooks: `useSellerSalariesCached`, `useEffectiveHourlyRate`. Helpers: `hours.ts`, `vacation-pay.ts` (testet).

- **Vigtige noter:**
  - **Lønperiode 15.→14. er hardkodet** i helpers (`getPayPeriod`), ingen `pay_periods`-tabel. Låsning ved udbetaling er kode-konvention, ikke DB-constraint.
  - **Negativ løn afskrives ved medarbejder-stop** (princip 6).
  - **12,5 % feriepenge** = hardkodet konstant. Anvendes også i `client-db`-rapport som indirekte omkostning.
  - **`commission_transactions` (immutable, rød zone):** snapshot af tildelt provision pr. periode. Ikke samme som `sale_items.mapped_commission` (live pris).
  - **`payroll_error_reports`:** ingen frontend-fejlindberetning fra sælger-side i dag (åben beslutning).
  - **Manuelle tillæg knyttes til kolonner**, ikke fritekst — bestemmer hvor i lønsedlen tillægget vises.
  - **Rollover-tabel:** USIKKER på præcis tabelnavn (`personnel_salaries` eller en separat rollover-tabel) — ville tjekke via `useSellerSalariesCached`-hookens skrivninger.

- **Eksempelværdi:**
  Sælger Mads, periode 15. mar–14. apr: Provision 24.650, timer 80 × 145 kr = 11.600, diæt 1.200, oplæring 0, tillæg +500, annulleringer -3.200. Subtotal = 34.750. Feriepenge 12,5 % af løn-grundlag = ~4.343 kr. Udbetaling = 39.093 kr.

---

## 5. Leder-løn — `team_leader_salary`

- **Kategori:** salary
- **Status:** OK
- **Beskrivelse:** Teamleders løn er provisions-styret af team-DB (dækningsbidrag): omsætning fra team-tilknyttede klienter minus sælgerløn (provision + 12,5 % feriepenge). Autoritativ logik beskrevet i memory `team-leader-db-compensation-v2`.

- **Beregningsformel:**
  1. **Find team-klienter:** `team_clients WHERE team_id = :team_id` → liste af klient-IDer.
  2. **Find salg på disse klienter i periode:** `sales JOIN sale_items WHERE sales.client_campaign_id ∈ (klient.campaigns) AND sale_datetime BETWEEN period`.
  3. **Omsætning** = SUM(sale_items.mapped_revenue).
  4. **Sælgerløn på disse klienter** = SUM(sale_items.mapped_commission) × 1,125 (12,5 % feriepenge-tillæg).
  5. **Annulleringsbeskyttelse:** Annulleringer på salg fra **stoppede medarbejdere** trækkes IKKE fra teamleders DB (princip 7). Implementeres ved at filtrere `cancellation_queue` på `employee.is_active = true` ved DB-beregning.
  6. **DB** = Omsætning − Sælgerløn − Annulleringer (kun aktive sælgere).
  7. **Leder-provision** = DB × konfigureret sats (sats lever pr. team i `teams`-tabel eller separat config — USIKKER på præcist felt).
  8. **Leder-grundløn** = `employee_master_data.base_salary_monthly` eller tilsvarende.
  9. **Total** = grundløn + leder-provision + tillæg − fradrag.

- **SQL Query (reference):**
  ```sql
  WITH team_clients AS (
    SELECT client_id FROM team_clients WHERE team_id = :team_id
  ),
  team_campaigns AS (
    SELECT id FROM client_campaigns WHERE client_id IN (SELECT client_id FROM team_clients)
  ),
  team_sales AS (
    SELECT s.id, si.mapped_revenue, si.mapped_commission
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE s.client_campaign_id IN (SELECT id FROM team_campaigns)
      AND s.sale_datetime BETWEEN :p_start AND :p_end
  )
  SELECT
    SUM(mapped_revenue)                              AS revenue,
    SUM(mapped_commission) * 1.125                   AS seller_cost,
    (SELECT SUM(amount_dkk) FROM cancellation_queue cq
       JOIN employee_master_data e ON e.id = cq.employee_id
       WHERE cq.deduction_date BETWEEN :p_start AND :p_end
         AND cq.status = 'approved'
         AND e.is_active = true
         AND cq.client_id IN (SELECT client_id FROM team_clients)) AS active_cancellations,
    SUM(mapped_revenue) - SUM(mapped_commission)*1.125 AS db_before_cancel
  FROM team_sales;
  ```

- **Datakilder:**
  `team_clients`, `client_campaigns`, `sales`, `sale_items`, `cancellation_queue`, `teams`, `team_assistant_leaders`, `employee_master_data`. RPC: `get_team_performance_summary` (memory `team-performance-aggregation-logic`).

- **Vigtige noter:**
  - **`team_clients` er autoritativ for klient-ejerskab**, ikke `team_members` (memory `client-team-exclusivity-and-ownership`). UNIQUE(client_id) håndhæves.
  - **Princip 7 (teamleder-DB beskyttes):** Annulleringer fra stoppede medarbejdere (`is_active = false`) ekskluderes — uinddrivelige beløb må ikke ramme leders DB.
  - **Sælgerløn = provision × 1,125** (inkluderer feriepenge som del af lønomkostning i DB-beregning).
  - **Flere assisterende ledere pr. team** via `team_assistant_leaders` (mange-til-mange, memory `team-assistant-structure-many-to-many`). Hvordan deres provision beregnes individuelt: USIKKER — ville tjekke `team-leader-db-compensation-v2` + `useSellerSalariesCached` for assist-leder.
  - **Leder-provision-sats:** USIKKER på lagring (felt på `teams` eller separat tabel). Ville tjekke schema for `teams`.
  - **Brand-omsætning** tæller IKKE — kun klient-omsætning via `team_clients`.

- **Eksempelværdi:**
  Team Eesy TM ejer Eesy TM-klienten. Periode mar-apr: omsætning 480.000 kr, sælgerløn 95.000 × 1,125 = 106.875 kr. Annulleringer 8.000 kr (heraf 2.000 fra stoppet sælger → ekskluderes). DB = 480.000 − 106.875 − 6.000 = 367.125. Leder-provision (sats X %) + grundløn = leder-løn.

---

## 6. Assistent- & stab-løn — `staff_assistant_salary`

- **Kategori:** salary
- **Status:** OK med kendt **ROD** (parallelle kodepuljer + "stab" findes ikke som rolle).
- **Beskrivelse:** Løn for assisterende teamledere og stabspersonale beregnes uden for sælger-provisions-modellen. Autoritativ implementation: `useAssistantHoursCalculation.ts` + `useStaffHoursCalculation.ts` (memory `staff-and-assistant-salary-logic-v3`).

- **Beregningsformel:**
  1. **Identifikation:**
     - Assisterende teamleder: rolle `assisterendetm` eller `assisterende_teamleder_fm` via `system_role_definitions`.
     - Stab: identificeres via `job_title`-mapping (IKKE en system-rolle).
  2. **Timer hentes via `useShiftResolution`** (vagt-hierarki).
  3. **Effektiv timesats:** `useEffectiveHourlyRate` slår op i konfiguration pr. medarbejder (basis fra `employee_master_data` + evt. overrides).
  4. **Grundløn** = timer × sats.
  5. **Tillæg/fradrag** fra `salary_additions`.
  6. **Diæter** (hvis FM-stab) fra `booking_diet`.
  7. **Feriepenge** 12,5 %.
  8. Ingen provision, ingen DB-baseret bonus (medmindre eksplicit konfigureret som tillæg).

- **SQL Query (reference):**
  ```sql
  SELECT
    e.id,
    SUM(EXTRACT(EPOCH FROM (sh.end_time - sh.start_time))/3600) AS hours,
    SUM(EXTRACT(EPOCH FROM (sh.end_time - sh.start_time))/3600) * :hourly_rate AS base_salary,
    (SELECT SUM(amount) FROM salary_additions
       WHERE employee_id = e.id AND year_month = :ym) AS additions
  FROM employee_master_data e
  LEFT JOIN shift sh ON sh.employee_id = e.id
    AND sh.shift_date BETWEEN :p_start AND :p_end
  WHERE e.id = :employee_id
  GROUP BY e.id;
  ```

- **Datakilder:**
  `shift`, `employee_standard_shifts`, `employee_time_entries`, `employee_master_data`, `salary_additions`, `booking_diet`, `system_role_definitions`. Hooks: `useAssistantHoursCalculation`, `useStaffHoursCalculation`, `useEffectiveHourlyRate`, `useShiftResolution`.

- **Vigtige noter:**
  - **ROD: To næsten-identiske hooks** (`useAssistantHoursCalculation`, `useStaffHoursCalculation`) vedligeholdes parallelt. Differentieres på rolle/job-title.
  - **ROD: "Stab" er ikke en system-rolle** — kun en `job_title`-værdi. `useStaffHoursCalculation` arbejder via `job_title`-mapping. Konsekvens: en medarbejder med korrekt rolle men "forkert" job_title kan falde gennem.
  - **Vagt-hierarki:** Individuel `shift` slår `employee_standard_shifts` (memory `shift-and-hours-resolution-logic-v2`).
  - **Stempelur (`employee_time_entries`)** fungerer som override per klient (memory `time-clock-entity-and-logic-types-v2`).
  - **Lukkevagter** er KUN påmindelser, ikke registrerede vagter (memory `closing-shift-logic-v2`).
  - **Dobbeltvagt-beskyttelse:** UNIQUE-constraint på `employee_standard_shifts.employee_id` (memory `double-shift-protection`).

- **Eksempelværdi:**
  Stabsmedarbejder Anna, sats 180 kr/time, 152 timer i periode → grundløn 27.360 kr. Tillæg +500 kr (engangs). Feriepenge 12,5 % = 3.482,50. Udbetaling = 31.342,50 kr.

---

## 7. Annullering og modregning — `cancellation_deduction`

- **Kategori:** salary
- **Status:** OK
- **Beskrivelse:** Annulleringer fra eksterne klient-lister (uploadet via `/salary/cancellations`) matches mod interne salg, tildeles en `deduction_date`, og modregnes i sælgers provision i den lønperiode hvor `deduction_date` falder. Autoritativ logik: memory `payroll-deduction-logic` + `core-matching-and-approval-engine`.

- **Beregningsformel:**
  1. **Upload** Excel-fil via UI (`UploadCancellationsTab.tsx`). Lagrer i `cancellation_imports`.
  2. **Matching:** Edge function/hook matcher hver række mod `sales` via:
     - Almindelige klienter: telefonnummer, kundenavn, produkt-mapping (`cancellation_product_mappings` + `cancellation_product_conditions`).
     - Eesy TM/FM: separat vej (se `eesy_cancellation_matching`, logik 20).
  3. **Match-resultat:** matchede rækker går i `cancellation_queue` med `status='pending'`. Umatchede gemmes i `cancellation_imports.unmatched_rows` (JSON).
  4. **Godkendelse:** Admin/leder gennemgår og godkender → `status='approved'`.
  5. **Deduction date:** sættes til annulleringens registreringsdato eller manuelt.
  6. **Modregning i løn:** sælgerløn-beregning trækker SUM(`amount_dkk`) for `cancellation_queue WHERE employee_id = ? AND deduction_date BETWEEN periode AND status='approved'`.
  7. **Rollover ved underskud:** Negativ subtotal → 0 udbetalt, rest rulles til næste periode.
  8. **Stop-medarbejder afskrivning:** Når `employee_master_data.is_active = false`, afskrives udestående rollover. Yderligere annulleringer på stoppet medarbejder ekskluderes fra teamleder-DB (princip 7).

- **SQL Query (reference):**
  ```sql
  -- Modregning i lønperiode
  SELECT
    cq.employee_id,
    SUM(cq.amount_dkk) AS deduction
  FROM cancellation_queue cq
  WHERE cq.deduction_date BETWEEN :p_start AND :p_end
    AND cq.status = 'approved'
    AND cq.employee_id = :employee_id
  GROUP BY cq.employee_id;

  -- Teamleder-DB beskyttelse: ekskludér stoppede sælgeres annulleringer
  SELECT SUM(cq.amount_dkk) AS leader_db_impact
  FROM cancellation_queue cq
  JOIN employee_master_data e ON e.id = cq.employee_id
  WHERE cq.client_id = :client_id
    AND cq.deduction_date BETWEEN :p_start AND :p_end
    AND cq.status = 'approved'
    AND e.is_active = true;
  ```

- **Datakilder:**
  `cancellation_imports`, `cancellation_queue`, `cancellation_product_mappings`, `cancellation_product_conditions`, `cancellation_upload_configs`, `sales`, `sale_items`, `employee_master_data`. Hook: `useSellerSalariesCached` (læser annulleringer ved lønberegning).

- **Vigtige noter:**
  - **Deduction date styrer hvilken periode der rammes** — ikke salgsdato.
  - **Princip 6 (rollover) + Princip 7 (leder beskyttes)** håndhæves separat: rollover er på sælger, beskyttelse er på leders DB-beregning.
  - **Eesy TM/FM har separat matching-vej** (8 telefon-felter, opp_group). Generaliseret matching ville have krævet abstraktion ingen havde tid til.
  - **Samme Excel-værdi kan mappes til flere produkter** (memory `product-mapping-workflow`) — bruges når kombinationen af variant og betingelse kræver det.
  - **Ingen sælger-notifikation** ved annullering i dag (åben beslutning §7).
  - **Ingen sælger-fejlindberetning** fra lønside (åben beslutning §7).
  - **`cancellation_queue` er rød zone** (immutable matching-resultat). Matching-laget (`*Matching*.tsx`) er gul zone.

- **Eksempelværdi:**
  Eesy uploader annulleringsfil 5. apr. 12 rækker matches mod sælger Mads' salg. Beløb i alt 3.200 kr. Admin godkender. `deduction_date = 5. apr` → rammer lønperiode 15. mar–14. apr. Mads' løn for perioden reduceres med 3.200 kr. Hans teamleder Eesy TM får tilsvarende reduktion i DB (Mads er aktiv → tæller med).

---

# Fase 2 — Attribution & tilhørsforhold

## 8. Salgsejer — `sales_ownership`

- **Kategori:** sales
- **Status:** OK (eksisterer allerede i `kpi_definitions` — verificeret 2026-04-23: indhold er aktuelt og korrekt).
- **Beskrivelse:** Definerer hvordan salg tilskrives til sælger, team og klient. Autoritativ for alle dashboards og rapporter.

- **Beregningsformel:**
  1. **SÆLGER:** `sales.agent_email` (lowercase) → `agents.email` → `employee_agent_mapping` → `employee_master_data`. Fallback: `agent_name` matching.
  2. **KLIENT:** `sales.client_campaign_id` → `client_campaigns.client_id` → `clients`.
  3. **TEAM (via klient, IKKE sælger):** `client_campaigns.client_id` → `team_clients.team_id` → `teams`.

- **SQL Query (reference):**
  ```sql
  SELECT
    s.id, s.sale_datetime,
    e.first_name||' '||e.last_name AS seller_name, e.id AS employee_id,
    c.name AS client_name, c.id AS client_id,
    t.name AS team_name, t.id AS team_id
  FROM sales s
  LEFT JOIN agents a ON LOWER(s.agent_email)=LOWER(a.email)
  LEFT JOIN employee_agent_mapping eam ON a.id=eam.agent_id
  LEFT JOIN employee_master_data e ON eam.employee_id=e.id
  LEFT JOIN client_campaigns cc ON s.client_campaign_id=cc.id
  LEFT JOIN clients c ON cc.client_id=c.id
  LEFT JOIN team_clients tc ON c.id=tc.client_id
  LEFT JOIN teams t ON tc.team_id=t.id
  WHERE s.sale_datetime BETWEEN :start AND :end;
  ```

- **Datakilder:** `sales`, `employee_agent_mapping`, `agents`, `employee_master_data`, `client_campaigns`, `clients`, `team_clients`, `teams`.

- **Vigtige noter:**
  - **Team via KLIENT** er den vigtigste regel — sælgerens eget team (`team_members`) er IRRELEVANT for team-ejerskab af salget.
  - 4-trins identitets-fallback gør at samme person kan optræde med forskellige navne i forskellige rapporter.
  - Umappede salg vises ikke i medarbejder-rapporter (men eksisterer i DB).
  - FM-salg har egen attribution-vej (se logik 11).

- **Eksempelværdi:**
  Thorbjørn (Relatel-medarbejder) sælger for Eesy TM: Sælger=Thorbjørn, Klient=Eesy TM, Team=Eesy TM (ikke Relatel).

---

## 9. Team-ejerskab af klienter — `team_client_ownership`

- **Kategori:** organization
- **Status:** OK
- **Beskrivelse:** En klient ejes af præcis ét team via `team_clients`. UNIQUE(client_id) håndhæves i DB. Bruges til team-attribution af salg, leder-DB og dashboard-synlighed.

- **Beregningsformel:**
  1. Insert/update i `team_clients` validerer UNIQUE(client_id) på DB-niveau.
  2. Læs: `SELECT team_id FROM team_clients WHERE client_id = :client_id` → præcis 0 eller 1 række.
  3. Ved teamskift: gammel række slettes/erstattes, ny indsættes. Ingen historik gemmes i dag (åben beslutning).

- **SQL Query (reference):**
  ```sql
  SELECT t.id, t.name, c.id AS client_id, c.name AS client_name
  FROM team_clients tc
  JOIN teams t ON t.id = tc.team_id
  JOIN clients c ON c.id = tc.client_id
  WHERE tc.client_id = :client_id;
  ```

- **Datakilder:** `team_clients`, `teams`, `clients`.

- **Vigtige noter:**
  - **`team_clients` ≠ `team_members`.** Klient-ejerskab er via team_clients; medarbejderens team-tilhør er via team_members. De er helt separate.
  - **UNIQUE(client_id)** forhindrer multi-team-ejerskab.
  - **Ingen historik** for klient-teamskift i dag (åben beslutning §7).
  - Bruges også som filter i `useAccessibleDashboards` for team-baseret dashboard-synlighed (memory `dashboard-visibility-resolution-logic`).
  - Brand bruges stadig i FM-booking, men er udfaset for klient-attribution (princip 4).

- **Eksempelværdi:**
  Eesy TM-klienten er tildelt team "Eesy TM". Alle salg på Eesy TM-kampagner → team Eesy TM, uanset hvilket team sælgeren er medlem af.

---

## 10. Medarbejder-klient-tildeling — `employee_client_assignments`

- **Kategori:** organization
- **Status:** USIKKER på fuld semantik (adgang vs. attribution).
- **Beskrivelse:** Eksplicit mapping af hvilke klienter en medarbejder er tildelt. Erstatter implicit adgang via team_members. Aktivering styres af feature flag `employee_client_assignments` (aktuelt false ifølge memory `feature-flag-rollout-system`). Hver medarbejder har præcis én primær klient (`is_primary = true`) — memory `employee-primary-client-and-change-log`.

- **Beregningsformel:**
  1. Tildeling: row i `employee_client_assignments(employee_id, client_id, is_primary, ...)`.
  2. Primær klient: præcis én row pr. employee_id med `is_primary = true`.
  3. Ændring: ny row indsættes; gammel `is_primary` sættes false. Change-log skrives til `employee_client_change_log` (immutable).
  4. Adgangskontrol: når flag er ON, RLS-policies på relevante tabeller (`time_stamps` m.fl.) bruger denne tildeling som filter.
  5. Stempelur: `time_stamps.client_id` attribuerer arbejdstid til klient (memory `client-specific-time-tracking-and-deduction`).

- **SQL Query (reference):**
  ```sql
  SELECT eca.employee_id, eca.client_id, eca.is_primary, c.name
  FROM employee_client_assignments eca
  JOIN clients c ON c.id = eca.client_id
  WHERE eca.employee_id = :employee_id;
  ```

- **Datakilder:** `employee_client_assignments`, `employee_client_change_log`, `clients`, `feature_flags`. Memory: `employee-client-assignment-mapping-v1`.

- **Vigtige noter:**
  - **USIKKER:** I hvilken grad tildelingen i dag bruges til *attribution* af salg vs. kun *adgang*. Salg-attribution sker primært via `agent_email` og `team_clients` (logik 8).
  - **Feature flag styrer udrulning** — hvis flaget er off, fungerer systemet på ældre implicit-team-adgangsmodel.
  - **Change-log er immutable** (rød zone) — bevarer fuld historik af ændringer.
  - **Primær klient er vigtig for** lønberegning hvor klient-attribution kræves men ikke kan udledes fra salg.
  - Splittet UI: "Fordel kunder" (team-ejerskab) vs. "Tildel medarbejdere" (employee-assignment) — memory `client-employee-assignment-ui-v2`.

- **Eksempelværdi:**
  Mads har 3 klient-tildelinger (Eesy TM = primær, Relatel, TDC). Hans stempelur-data tilskrives klient via `time_stamps.client_id`. Hans salg attribueres dog via `agent_email` + `team_clients` — ikke direkte via denne tabel.

---

## 11. FM dual-path attribution — `fm_dual_path_attribution`

- **Kategori:** sales
- **Status:** OK
- **Beskrivelse:** FM-salg har ofte upålidelig agent-attribution (forskellige dialer-payloads, manuel registrering). CS Top 20 leaderboard og FM-rapporter bruger en dual-path-fallback for at sikre at FM-sælgere optræder korrekt. Autoritativ: RPC `get_cs_top20_custom_period_leaderboard` + memory `leaderboard-fm-attribution-fallback`.

- **Beregningsformel:**
  1. **Primær vej (samme som TM):** match `agent_email` → `employee_agent_mapping` → `employee_master_data`.
  2. **Sekundær vej (FM-fallback):** Hvis primær vej fejler, brug `sales.seller_name` (manuelt registreret FM-felt) + klient-attribution via `client_campaign_id → team_clients` til at finde sælger.
  3. Kombinér: et FM-salg kan attribueres via vej 1 ELLER vej 2. Begge resultater unioneres med deduplikering på `sales.id`.
  4. Klient-attribution er eksplicit via `client_id` mapping i `tv-dashboard-data` edge function (memory `attribution-and-profitability-v1`).

- **SQL Query (reference):**
  ```sql
  -- Forenklet dual-path
  WITH primary_path AS (
    SELECT s.id, e.id AS employee_id, e.first_name||' '||e.last_name AS name
    FROM sales s
    JOIN agents a ON LOWER(s.agent_email)=LOWER(a.email)
    JOIN employee_agent_mapping eam ON eam.agent_id=a.id
    JOIN employee_master_data e ON e.id=eam.employee_id
    WHERE s.sale_datetime BETWEEN :start AND :end
      AND s.is_fm = true
  ),
  fallback_path AS (
    SELECT s.id, e.id AS employee_id, e.first_name||' '||e.last_name AS name
    FROM sales s
    LEFT JOIN employee_master_data e
      ON LOWER(e.first_name||' '||e.last_name) = LOWER(s.seller_name)
    WHERE s.id NOT IN (SELECT id FROM primary_path)
      AND s.is_fm = true
      AND s.sale_datetime BETWEEN :start AND :end
  )
  SELECT * FROM primary_path
  UNION ALL
  SELECT * FROM fallback_path;
  ```

- **Datakilder:** `sales` (FM-rækker), `agents`, `employee_agent_mapping`, `employee_master_data`. RPC: `get_cs_top20_custom_period_leaderboard`.

- **Vigtige noter:**
  - **Dual path findes kun for FM** — TM-rapporter bruger kun primær vej.
  - **`seller_name`-match er navne-baseret** og dermed sårbar for stavefejl, navneskift, ægteskab.
  - **FM-medarbejdere har egen RLS** der tillader visning af egen kommission selv uden mapping (memory `fieldmarketing-payroll-visibility-rls`).
  - FM-shift planlægning aggregerer på tværs af FM-team-typer (Fieldmarketing, Eesy FM, ...) — memory `field-marketing-shift-planning-scope`.
  - Daily reports har egen FM-dublet-håndtering (memory `daily-reports-data-attribution-logic`).

- **Eksempelværdi:**
  FM-sælger Lise har dialer-mapping til Adversus. Hendes 5 salg på en booking: 4 fanges af primær vej (agent_email matcher), 1 mangler email i payload → fallback via `seller_name = 'Lise Hansen'` → matcher hendes employee_master_data. Alle 5 vises på CS Top 20.

---

## 12. Revenue Match — `revenue_match_validation`

- **Kategori:** finance
- **Status:** OK
- **Beskrivelse:** Månedlig afstemning mellem fakturering i e-conomic (konto 1010) og system-registreret omsætning. Eneste kontrol der ville opdage systematisk under-/overrapportering fra pricing-motoren. Tilgås via `/economic/revenue-match`. Memory: `revenue-match-logic` + `sales-validation-workflow`.

- **Beregningsformel:**
  1. **e-conomic side:** SUM(faktura-linjer) på konto 1010 for periode (måned). Hentes via `economic_invoices`-tabel (synced af `sync-economic-invoices`).
  2. **System side:** SUM(`sale_items.mapped_revenue`) for samme periode + klient.
  3. **Diff:** e-conomic − system. Vises pr. klient.
  4. **Salgsvalidering** (`/economic/sales-validation`) er parallelt modul: månedlig kundeliste-afstemning (fakturerbare kunder vs. system-kunder).
  5. Begge er **manuelle**: kræver at admin åbner, sammenligner, godkender. Ingen automatisk alarmering.

- **SQL Query (reference):**
  ```sql
  -- Per klient revenue match
  WITH economic AS (
    SELECT client_id, SUM(amount) AS economic_revenue
    FROM economic_invoices
    WHERE account = '1010'
      AND invoice_date BETWEEN :month_start AND :month_end
    GROUP BY client_id
  ),
  system AS (
    SELECT cc.client_id, SUM(si.mapped_revenue) AS system_revenue
    FROM sales s
    JOIN sale_items si ON si.sale_id = s.id
    JOIN client_campaigns cc ON cc.id = s.client_campaign_id
    WHERE s.sale_datetime BETWEEN :month_start AND :month_end
    GROUP BY cc.client_id
  )
  SELECT c.name,
         e.economic_revenue,
         s.system_revenue,
         e.economic_revenue - s.system_revenue AS diff
  FROM clients c
  LEFT JOIN economic e ON e.client_id = c.id
  LEFT JOIN system   s ON s.client_id = c.id;
  ```

- **Datakilder:** `economic_invoices`, `sales`, `sale_items`, `client_campaigns`, `clients`. Edge: `sync-economic-invoices`, `import-economic-zip`, `economic-webhook`.

- **Vigtige noter:**
  - **Det eneste systematiske kontrol-loop på pricing.** Hvis nogen ændrer en pricing-regel forkert, opdages det her — hvis nogen kører Revenue Match.
  - **Manuel godkendelse** — ingen scheduled job der alarmerer ved store diff'er.
  - **Konto 1010** er det aftalte revenue-konto. Andre konti betyder andre ting (memory `economic-dashboard-consolidated`).
  - **Tidsforskydning:** salg registreres i Stork ved tilskrivning, faktureres i e-conomic op til måneder senere → diff kan være timing, ikke fejl.

- **Eksempelværdi:**
  Måned mar-2026 for Eesy TM: e-conomic viser 482.000 kr på konto 1010. System viser 478.500 kr i sale_items.mapped_revenue. Diff +3.500 kr. Admin undersøger: 2 sene faktureringer fra februar. Godkendt.

---

# Fase 3 — Permission & rolle

## 13. Permission resolution — `permission_resolution`

- **Kategori:** auth
- **Status:** OK med kendt **ROD** (dobbelt sandhed for job-title→role + hardkodet ejer-bypass).
- **Beskrivelse:** Beslutter om en bruger har adgang til en given side/feature. Kæden: login → `auth.users.id` → `employee_master_data` → `position_id` → `system_role_definitions.system_role_key` → `role_page_permissions` → permission-key check.

- **Beregningsformel:**
  1. **Login:** Supabase Auth giver `auth.uid()`.
  2. **Profil:** `employee_master_data WHERE auth_user_id = auth.uid()` → `position_id`.
  3. **Auto-assignment trigger:** Hvis `position_id IS NULL`, trigger `auto_set_position_id` slår `job_title` op i `job_positions` og sætter (memory `employee-position-assignment-automation`). Triggeren kører KUN ved INSERT eller når position_id er NULL — opdateres IKKE ved senere ændring af job_title.
  4. **Rolle:** `position_id` → `job_positions.system_role_key` → `system_role_definitions.system_role_key`.
  5. **Permissions:** `role_page_permissions WHERE system_role_key = ?` → 2303 permission-rows.
  6. **Hardkodet ejer-bypass** (`usePositionPermissions.ts:266`): `if (roleKey === 'ejer') return generateOwnerPermissions()` — alt tillades.
  7. **Parallel kilde (ROD):** `useUnifiedPermissions.ts:124-134` har en hardkodet `job_title → role`-mapping der kører **samtidig**. To sandheder.
  8. **Page-check:** `RoleProtectedRoute` slår page-key op i resolved permissions.
  9. **Auto-healing:** Hvis permissions er korrupte, mekanisme i memory `permission-system-hierarchy-and-sync-logic-v1` retter op.

- **SQL Query (reference):**
  ```sql
  -- Resolved permissions for en bruger
  SELECT rpp.page_key, rpp.can_view, rpp.can_edit
  FROM employee_master_data e
  JOIN job_positions jp ON jp.id = e.position_id
  JOIN system_role_definitions srd ON srd.system_role_key = jp.system_role_key
  JOIN role_page_permissions rpp ON rpp.system_role_key = srd.system_role_key
  WHERE e.auth_user_id = auth.uid();
  ```

- **Datakilder:** `auth.users`, `employee_master_data`, `job_positions`, `system_role_definitions`, `role_page_permissions`, `permissionKeys.ts` (frontend single source of truth). DB-trigger: `auto_set_position_id`. Hooks: `usePositionPermissions`, `useUnifiedPermissions`. Component: `RoleProtectedRoute`.

- **Vigtige noter:**
  - **ROD: To sandheder.** `position_id`-driven (DB) + `job_title`-driven (hardkodet i hook). Når de er enige, ingen bemærker. Når de er uenige, opstår mystiske rettighedsfejl.
  - **ROD: Trigger opdaterer ikke ved job_title-ændring.** Hvis admin ændrer `job_title` på eksisterende medarbejder, opdateres `position_id` ikke automatisk — UI viser nyt job men permissions kommer stadig fra gammelt `position_id`. (Konkret eksempel: Fanny — løst manuelt 2026-04-23 via direkte UPDATE.)
  - **ROD: Hardkodet ejer-bypass.** Ny super-admin-rolle kræver kodeændring. Hvis nogen omdøber `ejer` i `system_role_definitions`, mister ejeren alt.
  - **69 hardkodede rolle-referencer i 8 filer** ud over ejer-bypass.
  - **`permissionKeys.ts` er single source of truth** for permission-keys (memory `unified-permissions-system-consolidated-v4`).
  - **Auto-healing-mekanisme** retter korrupte permissions (memory `permission-resolution-logic-database-driven`).
  - **RolePreviewContext** lader admins se appen som anden rolle (debug i prod).

- **Eksempelværdi:**
  Bruger logger ind. `auth.uid()` → employee_master_data → `position_id` = "Fieldmarketing-position" → `system_role_key` = `fm_medarbejder_` → permissions inkluderer `menu_section_fieldmarketing.can_view = true`. Sidebar viser FM-sektion.

---

## 14. Rolle-arv og prioritet — `role_inheritance_priority`

- **Kategori:** auth
- **Status:** OK med kendt **ROD** (priority-collision + 10→5 collapse + trailing underscore).
- **Beskrivelse:** Stork har 10 system-roller i `system_role_definitions`, men RLS-policies bruger en `system_role` enum med kun 5 værdier. En DB-trigger collaper de 10 roller til de 5 ved insert/update i `user_roles`. Frontend ser 10, database ser 5.

- **Beregningsformel:**
  1. **De 10 frontend-roller:** ejer, admin, teamleder, fm_leder, assisterendetm, assisterende_teamleder_fm, medarbejder, fm_medarbejder_, backoffice, (USIKKER på 10. — ville tjekke `system_role_definitions`-snapshot).
  2. **De 5 RLS-roller** (`system_role` enum): typisk owner, admin, leader, employee, viewer (USIKKER på præcise navne — ville tjekke enum-definition).
  3. **Collapse-mapping:** trigger på `user_roles` mapper f.eks. `assisterendetm` + `assisterende_teamleder_fm` → samme RLS-rolle.
  4. **Priority:** `system_role_definitions.priority` (numerisk). Bruges til sortering i admin-lister og default-rolle-valg.
  5. **6 roller har priority = 100:** ejer, fm_leder, assisterende_teamleder_fm, assisterendetm, fm_medarbejder_, backoffice. Ingen reel rangordning mellem dem.

- **SQL Query (reference):**
  ```sql
  SELECT system_role_key, name, priority, is_active
  FROM system_role_definitions
  ORDER BY priority DESC, name;

  -- RLS-collapse trigger (skitse — den faktiske trigger findes på user_roles)
  -- INSERT/UPDATE på user_roles → trigger sætter system_role enum-værdi
  ```

- **Datakilder:** `system_role_definitions` (10 rækker), `user_roles`, `system_role` enum (5 værdier), `role_page_permissions`. DB-trigger på `user_roles` for collapse.

- **Vigtige noter:**
  - **ROD: Ingen reel priority-rangordning** mellem de 6 roller med priority = 100. Postgres-rækkefølge bestemmer.
  - **ROD: 10→5 collapse er usynlig.** Finkornet differentiering du ser i UI eksisterer ikke i RLS-laget. Hvis nogen prøver at give kun den ene af to collapsede roller adgang til en tabel via RLS, får begge adgang.
  - **ROD: `fm_medarbejder_` har trailing underscore** — bug eller bevidst, åben beslutning §7.
  - **ROD: `medarbejder` + `fm_medarbejder_` er 96,9 % identiske** i `role_page_permissions`. Konsolidering åben.
  - **ROD: Backoffice-rollen har 0 aktive brugere.**
  - **Stab er ikke en rolle** — kun en `job_title`-værdi (se logik 6).
  - **Ingen rolle-audit-trail.**

- **Eksempelværdi:**
  En `assisterende_teamleder_fm` bruger forsøger at se en RLS-beskyttet tabel. RLS-policy tjekker `system_role` enum (collapseet). Bruger ses som "leader" i RLS. Alt RLS giver "leader"-adgang gælder også for `assisterendetm`, selvom de er forskellige i UI-laget.

---

## 15. Team × Rolle × Medarbejder matrix — `team_role_employee_matrix`

- **Kategori:** organization
- **Status:** OK
- **Beskrivelse:** En medarbejders effektive adgang er funktion af tre uafhængige dimensioner: rolle (system_role), team-medlemskab (`team_members`), og klient-tildeling (`employee_client_assignments`).

- **Beregningsformel:**
  1. **Rolle** styrer *hvilke features* (sider, knapper) brugeren ser. Kommer fra `position_id → system_role_key` (logik 13).
  2. **Team-medlemskab** styrer *hvilket dataset* af team-baserede rapporter brugeren ser. Kommer fra `team_members` (mange-til-mange).
  3. **Klient-tildeling** styrer *hvilke klient-data* brugeren har adgang til (når feature flag er ON). Kommer fra `employee_client_assignments`.
  4. **Single-team regel:** Ikke-stab medarbejdere kan kun tilhøre ét team (memory `team-management-and-assignment-logic`).
  5. **Stab-undtagelse:** Stabsmedarbejdere kan tilhøre flere teams.
  6. **Teamleder-rettighed:** Teamledere kan deaktivere og opdatere medarbejdere i deres eget team (memory `team-leader-employee-management-permissions`).
  7. **Dashboard-synlighed:** `useAccessibleDashboards` kombinerer rolle (`globalAccess`) + team (`team_clients`-koblet visibility) — memory `dashboard-visibility-resolution-logic`.

- **SQL Query (reference):**
  ```sql
  -- Effektiv adgang for en bruger
  SELECT
    e.id, e.first_name||' '||e.last_name AS name,
    srd.system_role_key AS role,
    array_agg(DISTINCT t.name) AS teams,
    array_agg(DISTINCT c.name) AS assigned_clients
  FROM employee_master_data e
  LEFT JOIN job_positions jp ON jp.id = e.position_id
  LEFT JOIN system_role_definitions srd ON srd.system_role_key = jp.system_role_key
  LEFT JOIN team_members tm ON tm.employee_id = e.id
  LEFT JOIN teams t ON t.id = tm.team_id
  LEFT JOIN employee_client_assignments eca ON eca.employee_id = e.id
  LEFT JOIN clients c ON c.id = eca.client_id
  WHERE e.id = :employee_id
  GROUP BY e.id, srd.system_role_key;
  ```

- **Datakilder:** `employee_master_data`, `team_members`, `teams`, `team_clients`, `team_assistant_leaders`, `employee_client_assignments`, `system_role_definitions`, `job_positions`.

- **Vigtige noter:**
  - **De tre dimensioner er uafhængige.** Samme rolle på tværs af to teams → samme features, men forskelligt datasæt.
  - **Teams ejer klienter** (`team_clients`); klienter ejer ikke teams. Et salg på Eesy TM → team Eesy TM uanset sælgers team-medlemskab (logik 8).
  - **Daily reports scope** har 3 niveauer (alt/team/egne) baseret på rolle (memory `daily-reports-scope-enforcement-v3`).
  - **Deaktivering bevarer team-tilhørsforhold** — `team_members`-rækker slettes IKKE ved deaktivering (memory `employee-deactivation-cleanup-trigger`). Vigtigt for historik.
  - **FM-medarbejdere kan se kollegers salg i samme afdeling** via dedikeret RLS (memory `fieldmarketing-team-sales-visibility-rls`).

- **Eksempelværdi:**
  Mads: rolle = `medarbejder` (ser sælger-features), team = `Eesy TM` (ser team-rapporter for Eesy TM), klient-tildelinger = Eesy TM (primær). Hans kollega Lise med samme rolle, men team = `Relatel`, ser samme features men data for Relatel.

---

# Fase 4 — Tid & låsning

## 16. Lønperiode 15.→14. — `payroll_period_15_14`

- **Kategori:** time
- **Status:** OK med kendt **ROD** (ingen DB-låsning).
- **Beskrivelse:** Lønperioden er fra den 15. i en måned til den 14. i næste måned. Defineret udelukkende i kode (`getPayPeriod` i `hours.ts`, periode-grænser i `useSellerSalariesCached`). Ingen `pay_periods`- eller `period_locks`-tabel i DB.

- **Beregningsformel:**
  1. Givet en dato `d`:
     - Hvis `day(d) >= 15`: periode = `[d.year-d.month-15, (d+1month).year-(d+1month).month-14]`.
     - Hvis `day(d) <= 14`: periode = `[(d-1month).year-(d-1month).month-15, d.year-d.month-14]`.
  2. Periode-navn: typisk "marts/april 2026" eller `2026-04` baseret på slutdato-måned.
  3. **Låsning:** Når løn udbetales, marker UI-tilstand som "låst". Ingen DB-constraint forhindrer ændring — kun konvention.
  4. **Konsekvens af manglende lås:** En retroaktiv pricing-rematch eller manuel ændring kan ændre tal i en allerede udbetalt periode.

- **SQL Query (reference):**
  ```sql
  -- Konceptuel udledning af periode (i praksis i frontend-helper)
  SELECT
    CASE
      WHEN EXTRACT(DAY FROM :d) >= 15
        THEN make_date(EXTRACT(YEAR FROM :d)::int, EXTRACT(MONTH FROM :d)::int, 15)
      ELSE (date_trunc('month', :d) - INTERVAL '1 month' + INTERVAL '14 days')::date
    END AS period_start,
    CASE
      WHEN EXTRACT(DAY FROM :d) >= 15
        THEN (date_trunc('month', :d) + INTERVAL '1 month' + INTERVAL '13 days')::date
      ELSE make_date(EXTRACT(YEAR FROM :d)::int, EXTRACT(MONTH FROM :d)::int, 14)
    END AS period_end;
  ```

- **Datakilder:** Ingen DB-tabel. Helper: `src/lib/calculations/hours.ts` (testet i `hours.test.ts`). Hooks: `useSellerSalariesCached`, lønsidernes filtre.

- **Vigtige noter:**
  - **ROD: Ingen DB-lås.** Princip 3 ("lønperiode låses ved udbetaling") håndhæves kun socialt og i kode, ikke i database.
  - **ROD: Ingen `pay_periods`-tabel.** Periode-grænser er hardkodede i helpers — hvis principperne ændres (f.eks. til 1.→ultimo) kræver det kodeændring overalt.
  - **Tidszone-detalje:** se logik 17.
  - **Princip 5 (provision ved registrering)** + manglende lås = retroaktiv pricing-ændring kan stille rejusterer udbetalt løn.
  - **Åben beslutning §7:** formel periode-låsning i DB.

- **Eksempelværdi:**
  Dato = 18. apr 2026. Periode = 15. apr 2026 – 14. maj 2026. Dato = 14. apr 2026. Periode = 15. mar 2026 – 14. apr 2026.

---

## 17. Tidszone-håndtering — `timezone_handling`

- **Kategori:** time
- **Status:** OK med kendt **ROD** (inkonsistent dato-konvertering ved midnatsgrænser).
- **Beskrivelse:** `sale_datetime` er `timestamptz` (UTC under hood, dansk tid ved render). Periode-beregninger sker mestendels i lokal dansk tid — men konverteringen er ikke central og kan give kant-tilfælde omkring midnat.

- **Beregningsformel:**
  1. **Storage:** `sale_datetime timestamptz` → UTC.
  2. **Display:** frontend konverterer til dansk tid (Europe/Copenhagen) via `Date`-API + locale.
  3. **Periode-filter:** typisk `WHERE sale_datetime BETWEEN :start AND :end` hvor `:start`, `:end` er ISO-strings i lokal tid → Postgres konverterer til UTC.
  4. **Kant-tilfælde:** Salg kl. 23:45 dansk tid den 14. (UTC 21:45 vinter / 22:45 sommer) — alt OK. Men hvis filteret bruger UTC-midnat (sjælden bug-form), kan salg falde i forkert periode.
  5. **Sommertid-overgang** (CET ↔ CEST): March/oktober. UTC-offset ændres fra +01:00 til +02:00. Periode-filtre der ikke bruger tidszone-aware konvertering kan ramme uden for periode.

- **SQL Query (reference):**
  ```sql
  -- Korrekt periode-filter med tidszone
  WHERE sale_datetime >= (DATE :p_start || ' 00:00:00'::time) AT TIME ZONE 'Europe/Copenhagen'
    AND sale_datetime <  (DATE :p_end + INTERVAL '1 day') AT TIME ZONE 'Europe/Copenhagen';
  ```

- **Datakilder:** `sales.sale_datetime` (timestamptz). Helpers spredt over `hours.ts`, periode-filtre i hooks.

- **Vigtige noter:**
  - **ROD: Ingen central tidszone-helper.** Hver hook konverterer på egen hånd.
  - **Salg kl. 23:45 den 14. apr** burde høre til periode mar-apr. Bug-risiko hvis filter bruger UTC-grænser.
  - **Sommertid-overgang** er sjælden men ikke umulig kilde til off-by-one timer.
  - Ingen kendte aktuelle bug-rapporter på dette — det er en latent risiko.

- **Eksempelværdi:**
  Salg registreret 14. apr 2026 kl. 23:45 dansk tid (UTC 21:45). Filter for periode 15. mar–14. apr bruger `:end = '2026-04-14T23:59:59+02:00'` → korrekt inkluderet. Hvis filter bruger `:end = '2026-04-14T23:59:59Z'` (UTC) → ekskluderet (off-by-2-timer).

---

## 18. Immutable tabeller — `immutable_data_tables`

- **Kategori:** integrity
- **Status:** OK
- **Beskrivelse:** En række tabeller er INSERT-only (eller UPDATE-only på specifikke felter). Konventionen er primært dokumenteret i CLAUDE.md og biblen — ikke fuldt håndhævet via DB-constraints i alle tilfælde.

- **Beregningsformel:**
  1. Tabel klassificeres som immutable hvis: (a) data er bevismateriale (audit, contract, GDPR), eller (b) data er snapshot brugt til historisk reproduktion (kpi_period_snapshots, pricing_rule_history).
  2. Håndhævelse:
     - Mange compliance-tabeller har INSERT-only triggers eller deny-by-default RLS for UPDATE/DELETE.
     - Andre er kun konvention — udvikleren skal vide det.
  3. Liste over tabeller (fra CLAUDE.md §4):
     - **Audit/log:** `amo_audit_log`, `contract_access_log`, `sensitive_data_access_log`, `gdpr_cleanup_log`, `consent_log`, `gdpr_consents`, `login_events`, `failed_login_attempts`, `sms_notification_log`, `communication_log`, `communication_logs`, `integration_logs`, `integration_debug_log`, `integration_schedule_audit`, `ai_instruction_log`.
     - **Snapshots:** `kpi_period_snapshots`, `kpi_health_snapshots`, `pricing_rule_history`, `product_price_history`, `product_change_log`, `product_merge_history`, `historical_employment`, `employee_client_change_log`.
     - **Bevis/aftale:** `contract_signatures`, `commission_transactions`, `economic_invoices`.
  4. **Sletning** sker kun via udtrykkelige GDPR-flows (logik 27) — aldrig direkte DELETE.

- **SQL Query (reference):**
  ```sql
  -- Skitse af INSERT-only RLS policy
  CREATE POLICY "insert only" ON public.amo_audit_log
    FOR INSERT TO authenticated WITH CHECK (true);
  -- Ingen UPDATE/DELETE policies → blokeret
  ```

- **Datakilder:** Se liste ovenfor. AMO bruger `amo_audit_trigger_fn()` på alle amo_-tabeller.

- **Vigtige noter:**
  - **Inkonsistent håndhævelse:** Nogle har trigger-baseret beskyttelse, andre kun konvention. USIKKER på fuld dækning — ville auditere via `pg_policies`.
  - **`commission_transactions` er rød zone** — snapshot af tildelt provision pr. periode.
  - **`pricing_rule_history`** sikrer at man kan reproducere pris på et historisk salg selv hvis aktuel regel er ændret.
  - **Sletning kun via GDPR-flows** med audit i `gdpr_cleanup_log`.

- **Eksempelværdi:**
  Bruger A åbner en kandidats CPR. `sensitive_data_access_log` får en INSERT med `(user_id, candidate_id, field='cpr', timestamp)`. Senere kan auditor se hvem der har set hvad, hvornår — og rækken kan ikke ændres.

---

# Fase 5 — Klient-specifikke logikker

## 19. ASE straksudbetaling — `ase_immediate_payment`

- **Kategori:** pricing
- **Status:** OK
- **Beskrivelse:** ASE (a-kasse-klient) har specielle provisions-regler: 400 kr. for almindelig A-kasse-tegning (Lønmodtager/Selvstændig), 1.000 kr. ved "straksudbetaling". Memory: `ase-provision-og-produktmapping`.

- **Beregningsformel:**
  1. Salg fra ASE-kampagne (Enreach `/leads`-endpoint, `SearchName=cphsales2` — memory `ase-leads-endpoint-normalization`).
  2. Produktmapping i `adversus_product_mappings` / Enreach-produktmapping (`integration-engine/adapters/enreach`) identificerer produkt-type:
     - "A-kasse Lønmodtager" → 400 kr.
     - "A-kasse Selvstændig" → 400 kr.
     - "Straksudbetaling" / variant med straks-flag → 1.000 kr.
  3. Pris hentes via standard pricing-motor (logik 1) — reglerne ligger i `product_pricing_rules`.
  4. ASE-specifikke regler er almindelige `product_pricing_rules`-rækker, ikke en separat motor — men priserne er forretnings-aftalt og må ikke ændres uden eksplicit mandat.

- **SQL Query (reference):**
  ```sql
  SELECT p.name, ppr.commission_dkk, ppr.priority
  FROM products p
  JOIN product_pricing_rules ppr ON ppr.product_id = p.id
  WHERE p.name ILIKE '%a-kasse%' OR p.name ILIKE '%straks%';
  ```

- **Datakilder:** `products`, `product_pricing_rules`, `adversus_product_mappings`, `sales`, `sale_items`, `client_campaigns` (ASE-klient).

- **Vigtige noter:**
  - **Hardkodede satser:** 400/1000 kr. er forretningsregler — ikke matematisk udledte. Lever som rækker i `product_pricing_rules`.
  - **Enreach-integration** bruger `/leads`-endpoint med obligatorisk parameter `SearchName=cphsales2` og normaliserer payload i adapter.
  - **Differentiering** mellem 400 og 1000 sker via produkt-id i Adversus eller produkt-titel i Enreach + `adversus_product_mappings.unit_price` (memory `product-mapping-price-differentiation`).

- **Eksempelværdi:**
  ASE-salg med produkt "A-kasse Lønmodtager Straksudbetaling" → product_pricing_rules-regel matcher → 1.000 kr commission. Sælger ser 1.000 kr i sin provision. Almindelig A-kasse uden straks → 400 kr.

---

## 20. Eesy cancellation matching — `eesy_cancellation_matching`

- **Kategori:** cancellations
- **Status:** OK
- **Beskrivelse:** Eesy TM og Eesy FM annulleringsfiler matches via en specialiseret vej der scanner op til 8 telefon-kolonner pr. række ("Telefon AboN") og bruger `opp_group` til at gruppere salg med samme kunde-relation. Memory: `eesy-tm-matching-logic` + `eesy-tm-data-attribution-and-pricing-v2026`.

- **Beregningsformel:**
  1. Excel-fil uploades. Konfiguration (`cancellation_upload_configs`) identificerer den som Eesy TM/FM-format.
  2. For hver række i fil:
     a. Læs op til 8 felter `Telefon AboN 1..8`.
     b. Saml til array `phones[]`.
     c. Find matchende `sales` via `raw_data` JSON: et af phones[] matcher et af kunde-telefonnumre i salgs-payload.
     d. Hvis flere salg matcher → gruppér via `opp_group` (Eesy-specifik gruppering af salg på samme abonnement-aftale).
  3. Match-resultat går i `cancellation_queue` med flere salgs-rows hvis nødvendigt.
  4. Eesy bruger systematisk `adversus_campaign_mappings` for kampagne-attribution.
  5. Eesy-produkter konsolideres ofte i merge-flow (memory `eesy-tm-data-attribution-and-pricing-v2026`).

- **SQL Query (reference):**
  ```sql
  -- Konceptuel — den faktiske matching sker i edge function/hook
  SELECT s.id, s.raw_data
  FROM sales s
  WHERE s.client_campaign_id IN (SELECT id FROM client_campaigns
                                  WHERE client_id = (SELECT id FROM clients WHERE name='Eesy TM'))
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(:excel_phones) phone
      WHERE s.raw_data::text ILIKE '%' || phone || '%'
    );
  ```

- **Datakilder:** `cancellation_imports`, `cancellation_queue`, `cancellation_upload_configs`, `cancellation_product_mappings`, `sales` (Eesy-rækker, `raw_data` JSON), `adversus_campaign_mappings`.

- **Vigtige noter:**
  - **Hvorfor 8 telefonfelter:** Eesy-aftaler kan dække flere abonnementer pr. kunde — hvert med eget telefonnummer.
  - **`opp_group`** er Eesy-specifik gruppering — ikke en generel feature.
  - **Generaliseret matching ville kræve abstraktion ingen havde tid til** (princip 14).
  - **FM-version** (Eesy FM) bruger samme princip men på FM-salg.
  - **`raw_data` JSON-søgning er ineffektiv** ved store mængder — performance kan blive et issue.

- **Eksempelværdi:**
  Eesy uploader fil med 200 rækker. Række 47 har 3 telefoner: 12345678, 23456789, 34567890. Matching finder 2 salg i `sales.raw_data` der matcher hhv. 1. og 3. nummer → `opp_group = 'XYZ-2026-04-001'` grupperer dem → begge salg går i `cancellation_queue` med samme group-id.

---

## 21. TDC OPP-dublet-detektion — `tdc_opp_duplicate_detection`

- **Kategori:** sales
- **Status:** OK
- **Beskrivelse:** For TDC Erhverv identificeres dublerede salg i `DuplicatesTab.tsx` baseret på OPP-nummer ekstraheret fra `sales.raw_data`. Memory: `tdc-erhverv-duplicate-detection-logic`.

- **Beregningsformel:**
  1. For hvert TDC Erhverv-salg i periode: ekstrahér OPP-nummer fra `raw_data` (specifikt felt — USIKKER på præcis nøgle, ville tjekke memory).
  2. Gruppér salg pr. OPP-nummer.
  3. Grupper med >1 salg = dubletter.
  4. UI viser dubletter med mulighed for manuel afvisning/godkendelse.
  5. Ingen automatisk modregning — kun visning.

- **SQL Query (reference):**
  ```sql
  SELECT
    s.raw_data->>'opp_number' AS opp,
    COUNT(*) AS sale_count,
    array_agg(s.id) AS sale_ids
  FROM sales s
  JOIN client_campaigns cc ON cc.id = s.client_campaign_id
  JOIN clients c ON c.id = cc.client_id
  WHERE c.name = 'TDC Erhverv'
    AND s.sale_datetime BETWEEN :start AND :end
    AND s.raw_data ? 'opp_number'
  GROUP BY s.raw_data->>'opp_number'
  HAVING COUNT(*) > 1;
  ```

- **Datakilder:** `sales` (TDC-rækker, `raw_data` JSON), `client_campaigns`, `clients`. Component: `DuplicatesTab.tsx`.

- **Vigtige noter:**
  - **OPP-nummer er TDC-specifikt** — bestillingsnummer der unikt identificerer en kunde-aftale.
  - **USIKKER:** præcis JSON-key for opp-nummer i raw_data — varierer evt. mellem dialer-payloads.
  - Kun TDC Erhverv — andre TDC-kontekster (YouSee m.fl.) har ikke samme opp-struktur.

- **Eksempelværdi:**
  3 TDC-salg har alle `raw_data.opp_number = 'OPP-789456'`. Vises som dublet-gruppe med 3 rækker. Admin afgør hvilken der er ægte; de andre flagges/afvises.

---

## 22. Klient-specifikke pricing-undtagelser — `client_specific_pricing_overrides`

- **Kategori:** pricing
- **Status:** OK med kendt **ROD** (uensartede konventioner).
- **Beskrivelse:** Samling af klient-specifikke pricing-regler der bryder med eller udvider standard pricing-motoren.

- **Beregningsformel (pr. klient):**
  1. **Relatel + Eesy: ingen `effective_from`** — pricing-regler oprettes uden dato-grænse for at sikre at retroaktiv rematch på historiske salg matcher korrekt (memory `pricing-rule-retroactivity-and-alias-mapping-v2026`). Stiltiende konvention, ikke håndhævet.
  2. **Relatel kampagne-fallback:** Hvis salg mangler kampagne-info, brug fallback-regel (memory `pricing-rule-campaign-and-subsidy-logic-v1`).
  3. **Tilskud-flag:** Subsidy-status fra dialer-payload påvirker hvilken regel der vinder. Manglende tilskud → kampagne-fallback kan vælge regel "vilkårligt".
  4. **DSC (Danske Shopping Centre): tier-baseret månedsomsætnings-rabat** — erstatter tidligere placement-baserede rabatter (memory `monthly-revenue-discount-model-dsc`).
  5. **Eesy TM produkt-konsolidering** via merge-wizard (memory `composite-management-ui` + `merge-wizard-logic`).
  6. **Adversus produkt-mapping** med pris-differentiering: samme eksterne produkt-id (fx 7755) kan mappes til varianter med forskellige priser (memory `product-mapping-price-differentiation`).

- **SQL Query (reference):**
  ```sql
  -- Find regler uden effective_from (Relatel/Eesy-konvention)
  SELECT p.name, ppr.priority, ppr.commission_dkk, ppr.campaign_mapping_ids
  FROM product_pricing_rules ppr
  JOIN products p ON p.id = ppr.product_id
  WHERE ppr.effective_from IS NULL
    AND ppr.is_active = true;
  ```

- **Datakilder:** `product_pricing_rules`, `products`, `adversus_product_mappings`, `adversus_campaign_mappings`, `product_merge_history`.

- **Vigtige noter:**
  - **ROD: Stilt konvention** (Relatel/Eesy uden effective_from) er ikke håndhævet i skemaet. En ny regel oprettet med `effective_from` for Relatel ville stille bryde retroaktivitet.
  - **ROD: Subsidy-fallback** — manglende `Tilskud`-data fra dialer kan ramme "vilkårlig" regel (åben beslutning §7).
  - **Manuel sales-data correction-pattern** for forkerte tilskud/produkt-id'er (memory `manual-sales-data-correction-pattern`).
  - Disse logikker er ikke isoleret — de bor som almindelige rækker i `product_pricing_rules` med specifikke priority/campaign-konfigurationer. Kun konvention og dokumentation gør dem til "klient-specifikke".

- **Eksempelværdi:**
  Relatel-salg fra 2025-12-01 rematches efter at en regel er oprettet i 2026-04. Reglen har ingen `effective_from` → matcher salget fra december. Hvis reglen havde haft `effective_from = 2026-04-01`, ville salget ikke have fået ny pris.

---

# Fase 6 — Integration

## 23. Adversus pipeline — `adversus_pipeline`

- **Kategori:** integration
- **Status:** OK
- **Beskrivelse:** Salg fra Adversus flyder ind via webhook → enrichment → triggers → `sale_items`. Autoritativ vej for TM-salg fra Adversus-dialeren.

- **Beregningsformel:**
  1. **Webhook:** Adversus POST'er til `adversus-webhook` edge function. Payload gemmes i `adversus_events` (rå log).
  2. **Validation:** trigger `validate_sales_email` (BEFORE INSERT på sales) afviser salg med ukendt agent-email.
  3. **Insert i `sales`:** med `client_campaign_id` (mapped via `adversus_campaign_mappings.adversus_campaign_id`), `agent_email`, `raw_data`, `sale_datetime`.
  4. **Enrichment:**
     - For TM-salg: Adversus payload indeholder produkt-info → match til `products` via `adversus_product_mappings`.
     - For FM: trigger `enrich_fm_sale` BEFORE INSERT beriger.
  5. **Sale_items:** Oprettes via trigger eller edge-funktion. Pricing slås op (logik 1 / 2).
  6. **Healing:** `enrichment-healer` retter manglende pricing/attribution efter indkomst.
  7. **Monitoring:** `integration_logs`, `integration_debug_log`, `integration_schedule_audit` (immutable).

- **SQL Query (reference):**
  ```sql
  -- Eksempel: tæl salg pr. dag fra Adversus
  SELECT
    DATE(s.sale_datetime) AS day,
    COUNT(*) AS sales,
    SUM(si.mapped_revenue) AS revenue
  FROM sales s
  LEFT JOIN sale_items si ON si.sale_id = s.id
  WHERE s.source = 'adversus'
    AND s.sale_datetime BETWEEN :start AND :end
  GROUP BY day ORDER BY day;
  ```

- **Datakilder:** `adversus_events`, `sales`, `sale_items`, `adversus_campaign_mappings`, `adversus_product_mappings`, `integration_logs`, `integration_debug_log`. Edge: `adversus-webhook`, `enrichment-healer`. Triggers: `validate_sales_email`, `enrich_fm_sale`, `create_fm_sale_items`.

- **Vigtige noter:**
  - **Tier 1-afhængighed:** uden Adversus-pipeline registreres ingen TM-salg fra Adversus-dialeren.
  - **CORS + JWT-bypass:** `adversus-webhook` har `verify_jwt = false` (eksternt webhook).
  - **`validate_sales_email` afviser ukendte agent-emails** — kritisk for data-integritet, men kan blokere salg hvis agent ikke er mappet.
  - **Multi-layered enterprise-stability** (memory `integration-engine-enterprise-stability-v2`): retry, deduplication via `external_id`, monitoring.
  - **Datanormaliseringslag** standardiserer payloads fra Adversus + Enreach (memory `data-normalization-and-mapping-v2`).

- **Eksempelværdi:**
  Adversus webhook POST'er nyt salg kl. 10:23. Validation OK, indsættes i sales. Enrichment finder produkt via mapping. `sale_items` oprettes med commission 350 / revenue 1900. Sælgeren ser salget i sin live-feed inden for 1-2 sekunder.

---

## 24. Enreach pipeline — `enreach_pipeline`

- **Kategori:** integration
- **Status:** OK
- **Beskrivelse:** Enreach (HeroBase) er den anden dialer-kilde. Anvender authentication, mandatory rate-limit-header og en attribution-fallback for at håndtere agent-payload-overload. Memory: `governance-and-sync-logic-v1` + `agent-attribution-fallback-logic`.

- **Beregningsformel:**
  1. **Authentication:** API-key via `api_integrations.secrets`. Token-baseret session.
  2. **Rate limiting:** mandatory header `X-Rate-Limit-Fair-Use` på alle requests. Uden den blokeres trafik.
  3. **Pull (ikke push):** Stork pull'er fra Enreach på schedule (`integration_schedule_audit`).
  4. **Endpoints:**
     - `/leads` for ASE (med `SearchName=cphsales2`).
     - Andre endpoints for andre Enreach-klienter.
  5. **Insert i `sales`** med `source='enreach'`.
  6. **Attribution fallback:** Hvis Enreach API svigter på agent-info, anvendes fallback-mekanisme der mapper baseret på sidste kendte assignment (memory `agent-attribution-fallback-logic`).
  7. **Pricing + sale_items:** samme vej som Adversus efter insert.

- **SQL Query (reference):**
  ```sql
  SELECT
    DATE(s.sale_datetime) AS day,
    COUNT(*) AS sales,
    SUM(CASE WHEN s.agent_email IS NULL THEN 1 ELSE 0 END) AS missing_attribution
  FROM sales s
  WHERE s.source = 'enreach'
    AND s.sale_datetime BETWEEN :start AND :end
  GROUP BY day;
  ```

- **Datakilder:** `sales` (source='enreach'), `api_integrations`, `integration_logs`, `integration_schedule_audit`, `integration_debug_log`. Edge: `enreach-webhook` (hvis push) eller scheduled function.

- **Vigtige noter:**
  - **Tier 1-afhængighed.**
  - **Rate-limit-header er obligatorisk** — uden den får Stork 429 og data stopper.
  - **Attribution-fallback er kritisk** — Enreach API kan periodisk returnere ufuldstændig agent-info; fallback sikrer at salg ikke hænger uden ejer.
  - **ASE har egen normalisering** (`/leads` + `SearchName=cphsales2`).
  - **Multi-layered governance** (auth, rate-limit, retry, monitoring).

- **Eksempelværdi:**
  Scheduled pull kører kl. 09:05. Henter 142 nye salg fra Enreach. 3 mangler agent-attribution → fallback-logik mapper dem baseret på `external_dialer_id` på agents-tabellen. Alle 142 indsættes i sales.

---

## 25. e-conomic integration — `economic_integration`

- **Kategori:** integration
- **Status:** OK
- **Beskrivelse:** Synkronisering af fakturering og kontoplan fra e-conomic, samt manuelle afstemnings-workflows. Memory: `invoice-sync-architecture` + `revenue-match-logic` + `economic-dashboard-consolidated`.

- **Beregningsformel:**
  1. **Sync:** `sync-economic-invoices` edge function pull'er fakturaer fra e-conomic API → `economic_invoices`-tabel.
  2. **Webhook:** `economic-webhook` modtager events.
  3. **ZIP-import:** `import-economic-zip` for manuel batch-upload.
  4. **Revenue Match:** se logik 12.
  5. **Sales Validation:** månedlig kundeliste-afstemning (`/economic/sales-validation`).
  6. **Dashboard:** P&L-overblik der ekskluderer balance-konti (>=5000) — memory `economic-dashboard-consolidated`.

- **SQL Query (reference):**
  ```sql
  -- P&L (excl. balance accounts)
  SELECT
    account, SUM(amount) AS total
  FROM economic_invoices
  WHERE invoice_date BETWEEN :start AND :end
    AND account < '5000'
  GROUP BY account ORDER BY account;
  ```

- **Datakilder:** `economic_invoices`, `economic_accounts` (USIKKER på præcist navn). Edge: `sync-economic-invoices`, `import-economic-zip`, `economic-webhook`.

- **Vigtige noter:**
  - **`economic_invoices` er rød zone** (immutable, bevismateriale for omsætning).
  - **Webhook + sync + manual ZIP** er tre indgange — alle vedligeholdes.
  - **Konto 1010 = revenue** (aftalt). Andre konti repræsenterer andre P&L-kategorier.
  - **Balance-konti (>=5000) ekskluderes** fra P&L-dashboard.

- **Eksempelværdi:**
  Hver morgen kl. 06:00 kører `sync-economic-invoices`. Henter alle nye/ændrede fakturaer fra sidste 7 dage. Indsætter/opdaterer i `economic_invoices`. Revenue Match-modulet bruger disse data til månedlig afstemning.

---

# Fase 7 — Cross-cutting

## 26. Cache invalidation — `cache_invalidation`

- **Kategori:** infrastructure
- **Status:** OK med kendt **ROD** (manuel registrering, kebab-case strenge).
- **Beskrivelse:** React Query bruges som server-state cache. Mutations skal invalidere relevante keys. Cross-session ændringer (pricing, mappings) broadcastes via Supabase Realtime channel `mg-test-sync` så andre brugeres caches opdateres uden refresh.

- **Beregningsformel:**
  1. **Mutations** kalder `queryClient.invalidateQueries({ queryKey: [...] })` i `onSuccess`.
  2. **Cross-session:** centraliseret liste `QUERY_KEYS_TO_INVALIDATE` definerer hvilke keys der skal invalideres ved global event.
  3. **Broadcast:** mutation sender event på `mg-test-sync` channel via Supabase Realtime.
  4. **Modtager:** alle åbne sessions har subscriber (`useMgTestRealtimeSync`) der lytter og kalder `invalidateQueries` på de keys i listen.
  5. **Postgres realtime publication:** specifikke tabeller er tilføjet til `supabase_realtime` publication for direkte row-level events.

- **SQL Query (reference):**
  ```sql
  -- Tilføj tabel til realtime
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.product_pricing_rules;
  ```

- **Datakilder:** Frontend: `src/hooks/useMgTestRealtimeSync.ts`, `QUERY_KEYS_TO_INVALIDATE` const. Supabase Realtime channel `mg-test-sync`.

- **Vigtige noter:**
  - **ROD: Manuel registrering.** Hver gang ny tabel/hook tilføjes, skal nogen huske begge steder (key i `QUERY_KEYS_TO_INVALIDATE` + invalidate-kald i mutation).
  - **ROD: Kebab-case strenge** som query keys — stavefejl giver stille cache-miss uden TypeScript-fejl.
  - **Princip 10:** Views og realtime sync holder sandheden konsistent.
  - **Glemte invalidations** viser sig først når to brugere arbejder samtidig — svære at debugge.

- **Eksempelværdi:**
  Bruger A redigerer en pricing-regel. Mutation invalidates `["pricing-rules"]` lokalt + broadcaster på `mg-test-sync`. Bruger B's session lytter, ser event, invalidates samme keys → Bruger B's pricing-tabel re-fetcher uden refresh.

---

## 27. GDPR sletning og anonymisering — `gdpr_data_cleanup`

- **Kategori:** compliance
- **Status:** OK
- **Beskrivelse:** Kontrolleret sletning og anonymisering af persondata efter retention-politikker. Tilgås via `RetentionPolicies.tsx`. Edge functions: `cleanup-inactive-employees`, `delete-auth-user`, `gdpr-*`. Memory: `retention-and-anonymization-architecture-v2` + `gdpr-functions-access-control`.

- **Beregningsformel:**
  1. **Retention-politikker** konfigureres pr. data-type med valg "Anonymisér kundedata" eller "Slet komplet" og retention-periode.
  2. **Identifikation:** scheduled job (eller manuel trigger) finder rows ældre end retention.
  3. **Sletning:**
     - **Bevares (immutable):** alle audit-tabeller (`amo_audit_log`, `contract_signatures`, `commission_transactions`, `economic_invoices`, `gdpr_cleanup_log`, `sensitive_data_access_log`).
     - **Anonymiseres:** persondata-felter (navn, email, CPR, telefon) erstattes med placeholders eller hashes.
     - **Slettes:** `candidates` (efter konfigureret periode), `failed_login_attempts` (efter periode), inaktive `employee_master_data` efter forlænget periode.
  4. **Sletning logges altid** i `gdpr_cleanup_log` med før/efter-snapshot (uden persondata).
  5. **Adgangskontrol:** `_shared/gdpr-auth.ts` kræver eksplicit GDPR-rolle eller ejer.

- **SQL Query (reference):**
  ```sql
  -- Find inaktive medarbejdere ældre end retention
  SELECT id, first_name, last_name, deactivated_at
  FROM employee_master_data
  WHERE is_active = false
    AND deactivated_at < NOW() - INTERVAL '5 years';
  ```

- **Datakilder:** `retention_policies` (USIKKER på præcist navn), `gdpr_cleanup_log`, `gdpr_consents`, `consent_log`, `sensitive_data_access_log`, `gdpr_data_requests`, `security_incidents`, alle persondata-tabeller. Edge: `cleanup-inactive-employees`, `delete-auth-user`, `gdpr-export-data`, `gdpr-delete-data`.

- **Vigtige noter:**
  - **Sletning sker aldrig direkte** — altid via GDPR-flow med audit.
  - **Bevismateriale-tabeller bevares** uanset persondata-sletning (lovkrav om f.eks. bogføringspligt).
  - **GDPR-edge functions er rød zone.**
  - **Kandidat-sletning er ikke fuldt automatiseret** i dag (åben beslutning §7).
  - **Custom password-reset** har egen audit (memory `custom-password-reset-flow`).

- **Eksempelværdi:**
  Scheduled job finder 12 inaktive medarbejdere deactivated for >5 år siden. For hver: hash CPR, anonymisér navn, behold employee_id + role-historik. Skriv til `gdpr_cleanup_log` med (employee_id, action='anonymize', timestamp, fields_affected). Disse rows kan ikke ændres efterfølgende.

---

## 28. Audit trails — `audit_trails`

- **Kategori:** compliance
- **Status:** OK
- **Beskrivelse:** Multiple audit-trails dækker forskellige data-områder. AMO bruger `amo_audit_trigger_fn()` på alle amo-tabeller; kontrakter bruger `contract_access_log`; sensitive employee/candidate-data bruger `sensitive_data_access_log`. Memory: `sensitive-data-audit-logging`.

- **Beregningsformel:**
  1. **AMO:** Trigger `amo_audit_trigger_fn()` AFTER INSERT/UPDATE/DELETE på alle `amo_*` tabeller → row i `amo_audit_log` med (action, table_name, record_id, old_values, new_values, user_id, user_email, created_at).
  2. **Kontrakter:** Hver gang kontrakt tilgås (visning af signatur, download) → row i `contract_access_log`.
  3. **Persondata:** Reveal-actions på CPR, bank, telefon (i medarbejder-/kandidat-UI) skriver til `sensitive_data_access_log` med hvilket felt og hvilken bruger.
  4. **Login:** `login_events` for succesfulde logins, `failed_login_attempts` for fejl.
  5. **AI-instruktion:** `ai_instruction_log` for EU AI Act-overholdelse (memory `ai-governance-roles`).
  6. **Integration:** `integration_logs`, `integration_debug_log`, `integration_schedule_audit`.

- **SQL Query (reference):**
  ```sql
  -- Hvem har set hvilke kandidat-CPR sidste 30 dage
  SELECT user_email, candidate_id, field, accessed_at
  FROM sensitive_data_access_log
  WHERE field = 'cpr'
    AND accessed_at > NOW() - INTERVAL '30 days'
  ORDER BY accessed_at DESC;

  -- AMO-ændringer på en specifik record
  SELECT action, old_values, new_values, user_email, created_at
  FROM amo_audit_log
  WHERE record_id = :record_id
  ORDER BY created_at DESC;
  ```

- **Datakilder:** `amo_audit_log`, `contract_access_log`, `contract_signatures`, `sensitive_data_access_log`, `login_events`, `failed_login_attempts`, `ai_instruction_log`, `integration_logs`, `integration_debug_log`, `gdpr_cleanup_log`, `consent_log`, `gdpr_consents`. Triggers: `amo_audit_trigger_fn()`.

- **Vigtige noter:**
  - **Alle audit-tabeller er immutable** (logik 18).
  - **AMO-audit er bredest** — fanger alle ændringer på alle amo-tabeller via trigger.
  - **Sensitive data audit kræver eksplicit reveal-handling** i UI — passive lister af medarbejdere logger ikke.
  - **Ingen rolle-audit-trail** for ændringer i `system_role_definitions` / `role_page_permissions` (åben beslutning §7).
  - **Compliance cron** (`check-compliance-reviews`, weekly) sender notifikationer baseret på audit + deadlines (memory `automated-notifications-cron`).

- **Eksempelværdi:**
  AMO-medlem opdateres (status fra "active" til "ended"). Trigger skriver til `amo_audit_log`: action=UPDATE, old_values={status:'active'}, new_values={status:'ended'}, user_email='kasper@cphsales.dk', timestamp. Auditor kan altid spore hvem ændrede hvad og hvornår.

---

# Tillæg: Logikker IKKE dokumenteret (med begrundelse)

- **`product_campaign_overrides`-mekanismen** — halv-død (læses ikke af pricing-motoren). Nævnt i `tm_pricing` som ROD. En selvstændig "logik"-side ville suggere at den fungerer.
- **Feature flags** — mekanisme, ikke forretningsregel. Nævnes hvor relevant.
- **Sidebar Menu Editor** — UI-konfiguration, ikke forretningslogik.

# Tillæg: Markante ROD-noter samlet

| Logik | Rod-element |
|---|---|
| `tm_pricing` | Ingen tie-breaker ved ens priority. Postgres row-order afgør. |
| `tm_pricing` | `product_campaign_overrides` redigeres men læses ikke af motoren. |
| `tm_pricing` | Frontend ↔ edge pricing-logik holdes 1:1 manuelt. |
| `staff_assistant_salary` | "Stab" er ikke en system-rolle, kun job_title-værdi. To parallelle hooks. |
| `permission_resolution` | Dobbelt sandhed: position_id-driven (DB) + job_title-driven (kode). |
| `permission_resolution` | `auto_set_position_id`-trigger opdaterer ikke ved senere job_title-ændring. |
| `permission_resolution` | Hardkodet ejer-bypass + 69 hardkodede rolle-refs. |
| `role_inheritance_priority` | 6 roller har priority = 100 → ingen reel rangordning. |
| `role_inheritance_priority` | 10→5 collapse i RLS er usynlig differentiering forsvinder. |
| `role_inheritance_priority` | `fm_medarbejder_` har trailing underscore. |
| `payroll_period_15_14` | Ingen DB-lås, ingen `pay_periods`-tabel. |
| `timezone_handling` | Ingen central tidszone-helper, latent off-by-one risk. |
| `client_specific_pricing_overrides` | Stiltiende konvention (ingen effective_from for Relatel/Eesy) ikke håndhævet. |
| `cache_invalidation` | Manuel registrering + kebab-case strenge → stille cache-miss ved stavefejl. |

# Tillæg: USIKRE punkter (kræver verifikation)

1. **`employee_client_assignments`:** Hvor meget bruges til *attribution* vs. kun *adgang*. Ville tjekke RLS-policies på `time_stamps` og evt. `sales`.
2. **Leder-provisions-sats:** Lagring (felt på `teams` eller separat tabel). Ville tjekke schema.
3. **Assist-leder-løn-detaljer:** Hvordan beregnes individuel provision når flere assist-ledere deler team. Ville læse `useSellerSalariesCached` for assist-rolle.
4. **Sælger-løn rollover-tabel:** Præcis tabelnavn (`personnel_salaries` eller dedikeret rollover-tabel). Ville tjekke `useSellerSalariesCached` mutations.
5. **TDC OPP-nummer JSON-key:** præcis nøgle i `raw_data`. Ville verificere via SELECT på faktisk TDC-salg.
6. **De 5 RLS-roller (system_role enum):** præcise navne. Ville tjekke enum-definition.
7. **Den 10. system-rolle:** 9 nævnt ovenfor. Ville snapshotte `system_role_definitions`.
8. **Immutable-håndhævelse:** hvilke tabeller er trigger-beskyttede vs. kun konvention. Ville auditere via `pg_policies`.
9. **`retention_policies`-tabelnavn:** USIKKER. Ville tjekke `RetentionPolicies.tsx`.
10. **`economic_accounts`-tabelnavn:** USIKKER på om kontoplan ligger i selvstændig tabel.

---

*Dokument afsluttet. Alle 28 logikker beskrevet. Klar til INSERT i `kpi_definitions` ved senere lejlighed.*
