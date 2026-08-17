# Stork — Faktabilag

Genereret fra den faktiske database og kodebase. Supplement til `CLAUDE.md`. Hvor dette dokument og koden er uenige, er koden virkeligheden — rapportér uenigheden.

Nøgletal ved generering: 267 tabeller, 763 RLS-policies, 114 edge functions, 11 systemroller, 87 rute-rettighedsnøgler.

---

## 1. Databasen — tabelgrupper og markeringer

Markeringer er udledt af kolonnenavne: **LØN** (beløb/sats/timeløn), **PROV** (provision/commission/revenue), **PII** (CPR, bank, privat mail/telefon, adresse, kandidatdata).

### 1.1 Salg, produkter og pricing (kernen)

| Tabel | Vigtigste kolonner | Marker |
|---|---|---|
| `sales` | `client_campaign_id`, `agent_email`, `agent_name`, `agent_external_id`, `sale_datetime`, `status`, `validation_status`, `source`, `integration_type`, `raw_payload` (jsonb), `normalized_data` (jsonb), `internal_reference`, `enrichment_status` | PII (kundetlf/firma) |
| `sale_items` | `sale_id`, `product_id`, `quantity`, `unit_price`, `mapped_commission`, `mapped_revenue`, `needs_mapping`, `matched_pricing_rule_id`, `is_immediate_payment`, `is_cancelled`, `cancelled_quantity` | PROV |
| `products` | `client_campaign_id`, `name`, `commission_dkk`, `revenue_dkk`, `external_product_code`, `counts_as_sale`, `counts_as_cross_sale`, `is_active`, `is_hidden`, `priority`, `merged_into_product_id` | PROV |
| `product_pricing_rules` | `product_id`, `conditions` (jsonb), `commission_dkk`, `revenue_dkk`, `priority`, `campaign_mapping_ids` (uuid[]), `campaign_match_mode`, `effective_from`, `effective_to`, `allows_immediate_payment`, `immediate_payment_*` | PROV |
| `commission_transactions` | `sale_id`, `agent_name`, `client_id`, `transaction_type` (earn/clawback/manual_adjustment), `amount`, `reason`, `source` | PROV, immutable |
| `product_campaign_overrides` | kampagne-override af pris | PROV, **læses ikke af pricing-motoren** (åben beslutning, CLAUDE.md §7) |
| Historik | `pricing_rule_history`, `product_price_history`, `product_change_log`, `product_merge_history` | PROV, immutable |

Relationer: `clients → client_campaigns → products → product_pricing_rules`; `sales → sale_items → products`. `sales.client_campaign_id` er den eneste FK til klientsiden — klient udledes altid via kampagnen.

### 1.2 Løn og provision

`personnel_salaries` (`employee_id`, `salary_type`, `monthly_salary`, `percentage_rate`, `minimum_salary`, `hourly_rate`, `hours_source`, `start_date`) · `salary_types` (`amount`, `amount_type`, `calculation_basis`, `calculation_formula`, `activation_condition`, `group_restriction_*`, `payout_frequency`) · `salary_type_employees` · `salary_schemes` / `employee_salary_schemes` · `salary_additions` (`column_key`, `amount`, `period_start/end`) · `daily_bonus_payouts` · `team_client_daily_bonus` · `booking_diet`, `booking_startup_bonus` (FM-diæter/opstartsbonus) · `payroll_error_reports` · `cancellation_queue` (+ `cancellation_imports`, `cancellation_*_mappings`, `cancellation_product_conditions`, `cancellation_upload_configs`) · `client_adjustment_percents` · `employee_time_clocks` (`clock_type`: override/documentation/revenue, `hourly_rate`, `cpo_per_hour`) · `forecast_settings` · `onboarding_cohorts` · `location`, `location_placements` (FM-honorar) · `sync_daily_summary`, `integration_logs`, `integration_sync_runs`.

### 1.3 Persondata (GDPR-kritisk)

`employee_master_data` er den tungeste: `cpr_number`, `bank_reg_number`, `bank_account_number`, `address_*`, `private_email`, `private_phone`, `salary_type`, `salary_amount`, `salary_deduction`, `referral_bonus`, plus struktur (`team_id`, `last_team_id`, `position_id`, `system_role_id`, `job_title`, `manager_id`, `auth_user_id`, `is_active`, `is_staff_employee`, `is_freelance_consultant`, `can_work_fm`, `expected_monthly_shifts`, `employment_start_date`/`_end_date`).

Øvrige PII-tabeller: `candidates`, `applications`, `car_quiz_submissions`, `contract_signatures`, `contract_access_log`, `contract_policy_audit`, `sensitive_data_access_log`, `gdpr_consents`, `gdpr_data_requests`, `gdpr_cleanup_log`, `consent_log`, `login_events`, `failed_login_attempts`, `password_reset_tokens`, `employee_invitations`, `employee_identity`, `messages`, `communication_log(s)`, `scheduled_emails`, `sms_notification_log`, `master_employee`, `employee`, `transactions`, `security_incidents`, `amo_*` (medlemmer, audit, arbejdspladser), `eesy_fm_powerbi_rows`, `supplier_contacts`, `vehicle_return_confirmation`.

### 1.4 Organisation og adgang

`teams` (`team_leader_id`, `assistant_team_leader_id`) · `team_members` · `team_assistant_leaders` (mange-til-mange) · `team_clients` (UNIQUE på `client_id` = klient-eksklusivitet) · `scheduled_team_changes` · `job_positions` (`system_role_key`, `permissions` jsonb, `default_landing_page`, `requires_mfa`, `session_timeout_minutes`, `trusted_ip_ranges`) · `system_role_definitions`, `system_roles`, `user_roles` · `role_page_permissions` (`role_key`, `permission_key`, `can_view`, `can_edit`, `parent_key`, `permission_type`, `visibility`) · `role_dashboard_permissions`, `team_dashboard_permissions`, `user_menu_permissions`, `employee_dashboards` · `sidebar_menu_config`.

### 1.5 Identitet på tværs af dialere

`agents` (`name`, `email`, `source`, `external_adversus_id`, `external_dialer_id`, `user_id`) ← `employee_agent_mapping` (`employee_id`, `agent_id`, mange-til-mange) → `employee_master_data`. `sales.agent_email` er attributionsnøglen; der er **ingen FK** mellem `sales.agent_email` og hverken `agents` eller `employee_master_data`.

### 1.6 Øvrige domæner

Vagt/tid: `shift`, `employee_standard_shifts`, `team_standard_shifts`, `team_standard_shift_days`, `team_shift_breaks`, `closing_shifts`, `time_entry`, `time_stamps`, `time_off_request`, `absence_request_v2`, `employee_absence`, `lateness_record`, `danish_holiday`.
FM: `booking`, `booking_assignment`, `booking_hotel`, `booking_vehicle`, `hotel`, `vehicle`, `vehicle_mileage`, `mileage_report`, `location`, `brand` (isoleret, ingen FK), `fieldmarketing_sales`, `fm_checklist_*`, `eesy_fm_powerbi_*`, `supplier_*`.
Rekruttering: `candidates`, `candidate_sources`, `applications`, `booking_flow_*`, `recruitment_notifications`, `onboarding_*`, `cohort_members`.
Konkurrencer: `league_seasons`, `league_rounds`, `league_enrollments`, `league_*_standings`, `h2h_*`, `head_to_head_battles`, `powerdag_*`, `employee_sales_*`, `kpi_leaderboard_cache`.
KPI/cache: `kpi_definitions`, `kpi_cached_values`, `kpi_period_snapshots` (immutable), `kpi_health_snapshots`, `kpi_watermarks`, `kpi_dual_read_compare`, `kpi_reconcile_schedule`, `dashboard_kpis`.
Økonomi: `economic_*` (kontoplan, posteringer, imports, mapping, budget, fordelingsregler), `fixed_costs`, `billing_manual_expenses`, `team_expenses`.
Compliance/AMO: alle `amo_*`, `compliance_notification_recipients`, `data_retention_policies`, `campaign_retention_policies`, `ai_*`.
Integration: `api_integrations`, `dialer_integrations`, `dialer_calls`, `dialer_sessions`, `dialer_sync_state`, `adversus_*_mappings`, `adversus_events`, `integration_*`, `webhook_endpoints`, `provider_sync_locks`, `sync_state`, `sync_failed_records`.

### 1.7 Triggere på kernetabeller (verificeret)

`sales`: `validate_sales_email`, `generate_sales_internal_reference`, `enrich_fm_sale`, `create_fm_sale_items`, `league_enroll_on_sale`, `update_updated_at_column`.
**Bemærk:** `enrich_fm_sale` og `create_fm_sale_items` er hver registreret **to gange** (`trg_*` + `*_trigger`). Ikke ryddet op — undersøg før ændringer i FM-salgsflowet.
`employee_master_data`: `auto_set_position_id`, `sync_system_role_from_job_title`, `trigger_create_onboarding_tasks`, `remove_deactivated_employee_from_teams`, `generate_referral_code`, `fn_auto_assign_staff_all_clients`.
`booking`: `validate_booking_campaign`, `validate_booking_booked_days`, `cleanup_booking_assignments_on_days_change`.
`sale_items`: ingen triggere.

---

## 2. Roller og adgang

### 2.1 De 11 rollenøgler i `system_role_definitions`

`ejer`, `teamleder`, `assisterendetm`, `fm_leder`, `assisterende_teamleder_fm`, `fm_medarbejder_` (bemærk trailing underscore), `medarbejder`, `salgskonsulent_tdc_support`, `rekruttering`, `some`, `backoffice`.

### 2.2 Enum-skævheden

Postgres-enummet `system_role`, som RLS-policies bruger, har kun **5** værdier: `medarbejder`, `teamleder`, `ejer`, `rekruttering`, `some`. De 11 rollenøgler kollapses til disse 5 i databasen. Konsekvens: finkornet differentiering (fx `assisterendetm` vs. `teamleder`, eller `salgskonsulent_tdc_support` vs. `medarbejder`) eksisterer **kun i frontend-rettighedslaget** (`role_page_permissions`), ikke i RLS. En rolle kan altså se mindre i UI'et end RLS teknisk tillader.

### 2.3 Hvordan en bruger får sine rettigheder

```text
auth.uid()
  → employee_master_data.auth_user_id
    → position_id → job_positions.system_role_key   (primær kilde)
    → system_role_id → system_roles                  (ældre kilde)
    → job_title → hardkodet mapping i useUnifiedPermissions.ts  (parallel sandhed)
  → role_page_permissions[role_key] → can_view / can_edit pr. permission_key
  → user_menu_permissions / team_dashboard_permissions (overrides)
```

Ejer-bypass er hardkodet (`usePositionPermissions.ts`: `if (roleKey === 'ejer') return generateOwnerPermissions()`). En ny superrolle kan ikke oprettes uden kodeændring.

### 2.4 De hyppigste RLS-mønstre (antal policies der bruger dem)

| Funktion | Forekomster | Betydning |
|---|---|---|
| `auth.uid()` | 569 | ejerskab/self-access |
| `is_owner()` | 141 | fuld adgang for ejer |
| `is_teamleder_or_above()` | 135 | ledelsesadgang |
| `is_manager_or_above()`, `is_in_my_team(s)`, `can_view_employee()`, `has_role()`, `has_page_permission()` | resten | team-scoping og finkornede tjek |

Alle er `SECURITY DEFINER` med eksplicit `search_path` og ligger i rød zone.

---

## 3. Ruter og rolleadgang

Ruter defineres i `src/routes/config.tsx` og gates via `positionPermission`-nøgle (87 nøgler). Adgang nedenfor er `can_view = true` i `role_page_permissions`.

Forkortelser: **E**=ejer, **TL**=teamleder, **ATM**=assisterendetm, **FML**=fm_leder, **AFM**=assisterende_teamleder_fm, **FMM**=fm_medarbejder_, **M**=medarbejder, **TDC**=salgskonsulent_tdc_support, **R**=rekruttering, **S**=some, **BO**=backoffice.

### Alle roller (eller næsten alle)
`menu_home`, `menu_my_profile`, `menu_commission_league`, `menu_compliance_overview`, `menu_compliance_employee` (også BO) · `menu_absence`, `menu_shift_overview` (alle undtagen S/BO) · `menu_refer_a_friend` (alle undtagen ATM/AFM) · `menu_my_goals` (E, ATM, FML, FMM, M, TDC, S) · `menu_fm_my_schedule` (alle undtagen R/S) · `menu_dashboard_powerdag` (alle undtagen E og AFM).

### Kun ejer
`menu_dashboard`, `menu_dashboard_admin`, `menu_settings`, `menu_permissions` (+ATM), `menu_mg_test`, `menu_logics`, `menu_contracts`, `menu_customer_inquiries`, `menu_career_wishes_overview`, `menu_coc_admin`, `menu_car_quiz_admin`, `menu_pulse_survey`, `menu_kpi_definitions`, `menu_salary_types`, `menu_team_goals`, `menu_security_dashboard`, `menu_login_log`, `menu_extra_work_admin`, `menu_compliance_admin`, alle `menu_economic_*`, alle `menu_amo_*`, `menu_reports_admin`, `menu_reports_employee`, `menu_reports_management`, `menu_reports_revenue_by_client`.

### Ledelse (TM/FM)
`menu_employees` — E, TL, ATM, FML, AFM, R · `menu_cancellations` — E, TL, ATM, FML, AFM · `menu_sales` — E, TL, ATM · `menu_reports_daily` — E, TL, ATM, FML · `menu_reports_tdc_edit_sales` — E, TL, ATM, **TDC** · `menu_tdc_opsummering` — E, TL, R · `menu_time_tracking` — E, ATM, R · `menu_time_stamp` — E, ATM, R, S · `menu_upcoming_starts` — E, TL, ATM, FML, R, S.

### Fieldmarketing
`menu_fm_overview`, `menu_fm_booking`, `menu_fm_bookings`, `menu_fm_book_week`, `menu_fm_billing`, `menu_fm_locations`, `menu_fm_vehicles`, `menu_fm_time_off`, `menu_fm_edit_sales` — E, FML, AFM, ATM · `menu_fm_eesy_deviations` — kun E + FML · `menu_fm_sales_registration` — E, FML, AFM, ATM, FMM, M, TDC · `menu_fm_travel_expenses` — E, FML, AFM, ATM, FMM.

### Rekruttering / SoMe
`menu_candidates`, `menu_recruitment_dashboard`, `menu_upcoming_hires`, `menu_upcoming_interviews`, `menu_winback`, `menu_email_templates`, `menu_sms_templates`, `menu_extra_work` — E, R, S · `menu_onboarding_admin` — E, R · `menu_closing_shifts` — E, R · `menu_messages` — E, FML, R, S.

### Uden rettighedsrække
`menu_client_forecast` har **ingen** rækker i `role_page_permissions` — ruten er reelt kun tilgængelig via ejer-bypass. Bug eller bevidst; ikke afklaret.

---

## 4. Integrationer — hvordan data kommer ind

114 edge functions. De relevante for dataindtag:

### 4.1 Adversus (TM, primær salgskilde)
- `adversus-webhook` — push fra Adversus ved lead/salg. Rød zone. Skriver `adversus_events` → `sales` (+ `sale_items` via mapping) med `source='adversus'`, `raw_payload` = hele webhook-bodyen.
- `integration-engine` — planlagt pull (adapter-arkitektur, `adapters/adversus.ts`). Håndterer watermarks (`kpi_watermarks`, `dialer_sync_state`), run-locks (`integration_run_locks`), circuit breaker og DLQ (`sync_failed_records`).
- `adversus-sync-v2`, `sync-adversus`, `adversus-manage-webhooks`, `adversus-create-webhook`, `adversus-*-diagnostic(s)` — vedligehold og fejlsøgning.
- Produkt-/kampagnemapping: `adversus_product_mappings`, `adversus_campaign_mappings`.

### 4.2 Enreach (TM, telefoni + leads)
- `integration-engine` med `adapters/enreach.ts` — pull via API. Nøglenormalisering til Title Case for ASE-leads. orgCode-validering med fallback for agent-attribution.
- `enreach-manage-webhooks`, `enreach-diagnostics`, `probe-enreach-integration`, `test-ase-leads`.
- Kald/telefoni: `dialer-webhook`, `dialer_calls`, `dialer_sessions`, `call_records`.

### 4.3 Manuel indtastning og bulk
- `manual-sales` — "Tast selv salg" + "Bulk Salg (Leder)". Excel-parsing i frontend, matcher primært på telefonnummer, sekundært Emne-ID. Skriver `sales` + `sale_items` med `source='manual'`.
- FM: `sales`-triggerne `enrich_fm_sale` + `create_fm_sale_items` udfylder klient/kampagne og genererer salgslinjer automatisk.
- Eesy FM PowerBI: Excel upload til storage-bucket `eesy-fm-powerbi` → `eesy_fm_powerbi_imports` / `_rows` → afvigelsesvalidering mod `sales`.
- Annulleringer: Excel upload → `cancellation_imports` → `cancellation_queue` → godkendelse → `sale_items.is_cancelled` + `commission_transactions` (clawback).

### 4.4 Øvrige indgange
`economic-webhook` + `import-economic-zip` + `sync-economic-invoices` (bogføring) · `twilio-webhook`, `receive-sms`, `incoming-call` (telefoni/SMS) · `customer-inquiry-webhook`, `zapier-webhook`, `public-book-candidate` (offentlige) · `ms-graph-calendar`, `sync-contracts-to-sharepoint` (M365).

### 4.5 Format
Alt rådata gemmes ubehandlet i `sales.raw_payload` (jsonb) og normaliseret i `sales.normalized_data`. TDC OPP-nummer udtrækkes fra `raw_payload`. Der er ingen skema-validering af `raw_payload` — feltnavne varierer pr. dialer og pr. kampagne.

---

## 5. Løn- og provisionsberegning

**Farligste område i systemet. Alt herunder er rød zone.**

### 5.1 Provision (pr. salgslinje)

| Lag | Fil | Ansvar |
|---|---|---|
| Frontend | `src/lib/calculations/pricingRuleMatching.ts` (28 l.) | Matcher `sale_items` mod `product_pricing_rules` |
| Frontend | `src/lib/calculations/fmPricing.ts` (173 l.) | FM-specifik prissætning |
| Edge | `supabase/functions/_shared/pricing-service.ts` | Samme logik server-side |
| Edge | `rematch-pricing-rules` | Genberegner `mapped_commission` / `mapped_revenue` i batch, pagineret via `.range()` |
| DB | `create_fm_sale_items()`, `heal_fm_missing_sale_items()` | Genererer/heler FM-salgslinjer |

Hierarki: `product_pricing_rules` (højeste `priority` der matcher `conditions` + `campaign_mapping_ids` + `effective_from/to`) → produktets egne `commission_dkk`/`revenue_dkk`. `product_campaign_overrides` læses **ikke**.

Kendte risici: ingen sekundær sortering ved ens `priority` (tilfældigt resultat); ingen automatisk diff-test mellem frontend og edge — de kan drifte fra hinanden.

Skriver til: `sale_items.mapped_commission`, `sale_items.mapped_revenue`, `sale_items.matched_pricing_rule_id`, `pricing_rule_history`.

### 5.2 Løn (pr. medarbejder pr. periode)

Indgangspunkt: `src/hooks/useSellerSalariesCached.ts`. Understøttende: `useAssistantHoursCalculation`, `useStaffHoursCalculation`, `useEffectiveHourlyRate`, komponenterne i `src/components/salary/`.

Rene beregningsfiler i `src/lib/calculations/`: `dates.ts` (271 l., lønperiode-helpers), `formatting.ts` (182 l.), `hours.ts` (128 l., + test), `vacation-pay.ts` (84 l., + test).

Læser: `sale_items` (provision), `personnel_salaries`, `salary_types`, `salary_type_employees`, `salary_additions`, `employee_time_clocks`, `shift` / `employee_standard_shifts`, `cancellation_queue`, `daily_bonus_payouts`, `booking_diet`, `booking_startup_bonus`, `client_adjustment_percents`, `employee_master_data`.
Skriver: `commission_transactions`, `payroll_error_reports`, `kpi_period_snapshots` (via `snapshot-payroll-period`).

Timer-hierarki: 1) individuel `shift`, 2) tildelt `employee_standard_shifts`, 3) 0 timer. **Ingen ugedags-fallback.**

Lønperioden 15.→14. findes **ikke som data** — den er hardkodet i `dates.ts`. Der er ingen `period_locks`-tabel; retroaktiv rematch efter månedslukning har ingen forretningsregel.

### 5.3 Hvornår køres det
Provision: ved indtag (triggere), ved manuel "rematch" fra MgTest, og som baggrundsjob efter prisregelændringer. Løn: on-demand ved åbning af lønsiden (React Query cache), plus `snapshot-payroll-period` ved periodeafslutning. KPI: `calculate-kpi-incremental` / `calculate-leaderboard-incremental` på cron.

---

## 6. Konventioner

### 6.1 Navngivning
- Tabeller og kolonner: `snake_case`, engelsk. Domænepræfiks (`amo_`, `economic_`, `booking_`, `league_`, `kpi_`, `fm_`, `cancellation_`).
- Hooks: `src/hooks/useXxx.ts`, flad mappe, camelCase. Én hook pr. datadomæne.
- React Query keys: kebab-case strings, fx `"sales-aggregates"`. Cross-session-ændringer broadcastes på kanalen `mg-test-sync` og nøglen tilføjes `QUERY_KEYS_TO_INVALIDATE`.
- Komponenter: `PascalCase.tsx` under `src/components/<feature>/`; sider under `src/pages/<feature>/`.
- Rettighedsnøgler: `menu_<område>_<underområde>`, defineret i `src/config/permissionKeys.ts` (single source of truth).
- Edge functions: kebab-case mappenavn, `index.ts` med `serve` + CORS + try/catch, delt kode i `_shared/`.
- DB-funktioner: `snake_case`, prædikater som `is_*` / `has_*` / `can_*`, `SECURITY DEFINER` med eksplicit `search_path`.
- Triggere: `trg_<tabel>_<handling>` (ældre uden præfiks findes stadig).

### 6.2 Design-tokens (`src/index.css` + `tailwind.config.ts`)
Alle farver er HSL-tripler i CSS-variabler og eksponeres som Tailwind-klasser. **Aldrig hardkodede farver i komponenter.**

Standardtema (mørkt, `:root`): `--background 222 47% 9%`, `--card 222 47% 12%`, `--primary 161 93% 40%` (grøn), `--secondary 222 30% 20%`, `--muted-foreground 0 0% 70%`, `--destructive 0 72% 50%`, `--border 222 30% 20%`, `--radius 0.75rem`.
Lyst tema (`.light`): `--background 0 0% 100%`, `--primary 217 91% 55%` (blå).
`.dark`-variant: `--primary 158 64% 51%`, plus chart-farver `--chart-1..5`.

Semantiske ekstratokens: `--success`, `--warning`, `--danger` (+ `-foreground`), status (`--status-new/progress/success/rejected/warning`), roller (`--role-fieldmarketing 262 83% 58%`, `--role-salgskonsulent 173 80% 40%`), KPI (`--kpi-positive/negative/neutral`), sidebar (`--sidebar-*`).

Typografi: `--font-sans` = Work Sans, `--font-serif` = Lora, `--font-mono` = Inconsolata. Kontrakt-visning bruger Source Serif 4.
Skygger: `--shadow-xs` … `--shadow-xl`. Spacing-base: `--spacing 0.25rem`.

Brug altid `bg-background`, `text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`, `bg-primary`, `text-destructive` osv. — ikke `bg-white`, `text-black` eller `bg-[#...]`.

### 6.3 Kodemønstre
- Data hentes kun i hooks med React Query — aldrig `supabase.from()` i JSX (146 filer bryder dette; ryd op opportunistisk).
- Aggregering via `SECURITY DEFINER` RPC (fx `get_sales_aggregates_v2`, `get_sales_report_raw`, `get_team_performance_summary`).
- Typer fra `Database['public']['Tables'][...]['Row']`. `: any` kun til Json/3rd party (855 eksisterende forekomster — undgå nye).
- Mutations kaster; toast i `onError`; `invalidateQueries` efter succes.
- Ingen efterladte `console.log` (182 eksisterende), ingen hardkodede rolle-keys, ingen `localStorage` til forretningsdata.

---

*Genereret fra live database og `origin/main`. Tal og lister forældes — verificér mod koden ved tvivl.*
