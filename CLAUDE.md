# Copenhagen Sales — Claude Code kontekst

Dette er startuploaden for enhver AI-session i dette repo. Læs hele filen før første handling. Ved konflikt med andre kilder vinder denne fil. Detaljer findes i `/mnt/project/`-rapporter og i memory-noter (~95 stk).

---

## 1. Hvem arbejder du for

**Copenhagen Sales ApS** — dansk salgsvirksomhed (TM + FM) med 100+ aktive brugere. Klienter: Tryg, Finansforbundet, Nuuday (YouSee, TDC Erhverv, Eesy), ASE.

**Ejere:** Mathias Dandanel Grubak (adm. dir., primær teknisk lead) og Kasper (partner, ikke-teknisk men aktiv promptbruger). To personer. Ingen QA, intet DevOps-team, ingen senior-udvikler at spørge. Kompleksitet der kræver dedikeret ekspertise er en byrde, ikke en feature.

**Svarsprog:** Dansk. Altid.

---

## 2. Systemet i tal

- **Stack:** React + TypeScript + Supabase + Lovable (primær udviklingsmotor)
- **Database:** 267 tabeller, 120 RPC'er, 662 migrations
- **Frontend:** 408 komponenter, 179 sider, 111 hooks
- **Edge functions:** 109
- **Tests:** 3 filer (`hours.test.ts`, `vacation-pay.test.ts`, `cronOverlapDetector.test.ts`)
- **Memory-noter:** ~95 stk (sekundær dokumentation)
- **Compliance:** GDPR, EU AI Act, bogføringsloven, arbejdsmiljøloven

---

## 3. De 15 grundprincipper (tidsløse — bærer alle beslutninger)

### Forretning
1. **Databasen er sandheden.** Alt andet er views af samme sandhed.
2. **Historik bevares altid.** Med strategi for arkivering og sletning over tid.
3. **Lønperiode låses ved udbetaling.** (Formel DB-lås er åben beslutning — i dag kode-konvention.)
4. **Klient er dimensionen.** Brand udfases gradvist; FM-booking bruger den stadig.
5. **Provision ved registrering.** Motivation vigtigere end timing-præcision.
6. **Lønunderskud ruller over.** Ingen negativ løn. Afskrives ved medarbejder-stop.
7. **Teamleder-DB beskyttes.** Uinddrivelige beløb fra stoppede medarbejdere tæller ikke.

### System
8. **Single source of truth, også i koden.** Samme forretningsregel må kun eksistere ét sted. Duplikeret logik driver.
9. **Data-adgang går gennem service-lag.** Komponenter tilgår aldrig Supabase direkte — altid via custom hook med React Query.
10. **Views og realtime sync holder sandheden konsistent.** Mutations skal invalidere relevante caches. Cross-session ændringer (pricing, mappings) broadcastes.

### Arbejde
11. **Biblen er startuploaden, memory-noter er detaljen.** Ved konflikt vinder biblen/denne fil.
12. **Zone-tvivl er rød zone.** Ved tvivl: spørg. Rød zone kræver eksplicit skriftlig godkendelse.
13. **Kort, konkret, highlighted.** Start med konklusionen. Bullets og overskrifter til det scanbare. Aldrig salgssprog eller selvros.
14. **Konsolidering er ikke nok — oprydning er nødvendig.** Skygge-kode er teknisk gæld der akkumulerer rente. Når du konsoliderer, foreslå også sletning af det erstattede.
15. **Forståelse før handling.** Hvorfor løses opgaven? Hvilke principper påvirkes? Implementation kommer sidst.

---

## 4. Zone-regler — STOP og læs før hver ændring

```
Filen i RØD ZONE?  → STOP. Bed om eksplicit godkendelse + plan.
Filen i GUL ZONE?  → Lav plan. Bekræft. Test før deploy.
Filen i GRØN ZONE? → Implementér med standard-kvalitetstjek.

Berører ændringen lønberegning?  → Altid RØD.
Berører ændringen persondata?    → Altid RØD.
Berører ændringen DB-skema?      → Altid migration + RLS-tjek.
```

### Top 10 filer der ALDRIG må ændres uden godkendelse
1. `src/lib/calculations/hours.ts`
2. `src/lib/calculations/vacation-pay.ts`
3. `src/lib/calculations/fmPricing.ts`
4. `src/lib/calculations/pricingRuleMatching.ts`
5. `supabase/functions/_shared/pricing-service.ts`
6. `supabase/functions/_shared/gdpr-auth.ts`
7. `src/config/permissionKeys.ts`
8. `src/hooks/useSellerSalariesCached.ts`
9. `supabase/functions/adversus-webhook/index.ts`
10. `supabase/functions/economic-webhook/index.ts`

### Top 10 tabeller der ALDRIG må slettes/truncates
`commission_transactions`, `sale_items` (mapped_commission/revenue), `economic_invoices`, `amo_audit_log`, `contract_signatures`, `gdpr_cleanup_log`/`gdpr_consents`, `sensitive_data_access_log`, `pricing_rule_history`, `kpi_period_snapshots`, `historical_employment`.

### Rød zone-kategorier (fuld liste)
- **Lønberegning:** `src/lib/calculations/*.ts`, `src/hooks/useSellerSalariesCached.ts`, `useAssistantHoursCalculation`, `useStaffHoursCalculation`, `useEffectiveHourlyRate`, alle filer i `src/components/salary/`, tabeller: `commission_transactions`, `salary_*`, `personnel_salaries`, `daily_bonus_payouts`, `cancellation_queue`, `payroll_error_reports`.
- **Pricing-motor:** `pricingRuleMatching.ts`, `fmPricing.ts`, `_shared/pricing-service.ts`, `rematch-pricing-rules/`, DB-funktion `create_fm_sale_items`, `heal_fm_missing_sale_items`, tabeller: `product_pricing_rules`, `pricing_rule_history`, `sale_items` (mapped_commission/revenue), `product_campaign_overrides` (se §7).
- **GDPR/persondata:** Alle `gdpr-*` edge functions, `cleanup-inactive-employees`, `delete-auth-user`, `_shared/gdpr-auth.ts`, tabeller: `employee_master_data` (CPR/bank), `candidates`, `gdpr_consents`, `sensitive_data_access_log`, `gdpr_cleanup_log`, `contract_signatures`, `security_incidents`, `gdpr_data_requests`.
- **Auth/RLS:** `permissionKeys.ts`, `permissions.ts`, `useAuth`, `usePositionPermissions`, `useUnifiedPermissions`, `RoleProtectedRoute`, alle SECURITY DEFINER auth-funktioner, `system_roles`, `user_roles`, `role_page_permissions`, `system_role_definitions`, `failed_login_attempts`.
- **AMO:** Alle `amo_*` tabeller, `amo_audit_log`, `amo_audit_trigger_fn()`, `check-compliance-reviews`, `src/pages/amo/`, `src/pages/compliance/`.
- **Bogføring:** `economic_invoices`, `economic-webhook`, `import-economic-zip`, `sync-economic-invoices`, Revenue Match, Sales Validation.
- **Integrations-webhooks:** `adversus-webhook`, `enreach-webhook`, `twilio-webhook`, `dialer-webhook` (CORS + `validate_sales_email`-trigger kritisk).
- **Historisk data (immutable — aldrig UPDATE/DELETE):** `kpi_period_snapshots`, `kpi_health_snapshots`, `pricing_rule_history`, `product_price_history`, `product_change_log`, `product_merge_history`, `contract_signatures`, `contract_access_log`, `amo_audit_log`, `gdpr_cleanup_log`, `consent_log`, `gdpr_consents`, `sensitive_data_access_log`, `login_events`, `failed_login_attempts`, `commission_transactions`, `economic_invoices`, `historical_employment`, `employee_client_change_log`, `ai_instruction_log`, `integration_logs`, `integration_debug_log`, `integration_schedule_audit`, `sms_notification_log`, `communication_log`, `communication_logs`.
- **Feature flags:** `feature_flags`-tabellen styrer arkitektoniske rollouts. Rød zone.
- **Transactions:** `transactions`-tabellen (verificér betydning før ændring).

### Gul zone
Dashboards, rapporter, rekruttering/booking_flow, FM-booking (ikke pricing), MgTest (undtagen pricing-editor), team-management, cancellation matching-lag (queue er rød, matching er gul), cache/realtime (`useMgTestRealtimeSync`), query-keys, Powerdag-tabeller, sidebar/navigation, chat/SMS-conversations.

### Grøn zone
Styling (`index.css`, `tailwind.config.ts`, `components/ui/*`), i18n/labels, layout/ikoner, offentlig booking-side, TV-boards (read-only), dokumentation, tests (mere er bedre).

---

## 5. Arkitektoniske mønstre (følg disse)

1. **Data-fetching:** React Query i custom hook (`src/hooks/useXxx.ts`). Komponenter må ALDRIG kalde `supabase.from()` eller `supabase.rpc()` direkte. (146 filer bryder allerede dette — ryd op opportunistisk, ikke i store refactors.)
2. **State:** Server-state = React Query cache med `queryKey`. UI-state = `useState`/`useReducer`. Globale UI-modes = Context. Ingen Redux/Zustand/Jotai.
3. **Struktur:** `pages/<feature>/`, `components/<feature>/`, `hooks/useXxx.ts` (flad hook-mappe).
4. **DB:** CRUD = `.from()`. Aggregering = `SECURITY DEFINER` RPC. Delt udregning mellem frontend og edge = placeret i `supabase/functions/_shared/` + `src/lib/calculations/` og holdt 1:1 synkroniseret.
5. **Fejl:** Mutation kaster, toast i `onError`. Edge functions returnerer `{ error: string }` med HTTP-status.
6. **Typer:** Brug `Database['public']['Tables'][...]['Row']`. `: any` kun for Json/3rd party. (855 forekomster i dag — undgå nye.)
7. **Edge functions:** `serve` + CORS + try/catch + JSON. Delt logik → `_shared/`.
8. **Cache:** `invalidateQueries` efter mutation. Cross-session ændringer (pricing, produkter, mappings) → `broadcast` på `mg-test-sync` + tilføj key til `QUERY_KEYS_TO_INVALIDATE`. Query-keys i kebab-case (`"sales-aggregates"`).
9. **Tests:** Ren forretningslogik i `src/lib/calculations/` eller `src/utils/` med `.test.ts` ved siden af. UI/hook-tests ikke påkrævet.
10. **Forbudte mønstre (ny kode må ikke introducere nye forekomster):**
    - `supabase.` direkte i JSX
    - `useEffect + useState + supabase` (manuel fetch)
    - `: any` (brug Database-typer)
    - Efterladte `console.log`
    - Hardkodede rolle-keys (`if (role === 'ejer')`) — brug permission-systemet
    - Duplikeret pricing-logik frontend vs. edge
    - Query keys uden central registrering
    - `localStorage` til business-data (kun UI-prefs)

---

## 6. Kritiske afhængigheder (tier-klassificeret)

**Tier 1 — nedbrud rammer hele driften:**
- `integration-engine` (Adversus/Enreach-pipeline — uden denne registreres ingen nye salg)
- `product_pricing_rules` + `rematch-pricing-rules` (pricing-motoren)
- `useSalesAggregates` + RPC'er (single source of truth for salg)
- Rolle-/rettighedssystem (`permissionKeys.ts`, `usePositionPermissions`, `useUnifiedPermissions`, `system_role_definitions`, `role_page_permissions`)
- Supabase Auth + custom password-reset
- `calculate-kpi-incremental` + cache-tabeller

**Tier 2 — vigtige men isolerede:**
- `sales_ownership`-attribution (via `agent_email` + `employee_agent_mapping`)
- FM dual-path attribution (CS Top 20 leaderboard-logik med fallback)
- `adversus_campaign_mappings`
- TDC OPP-dublet-detektion (`DuplicatesTab.tsx`)
- Twilio voice + SMS
- M365 Graph (email, kalender, SharePoint)
- e-conomic (Revenue Match, Sales Validation — månedlig afstemning)
- `process-booking-flow` cron (hver 5. min)

**Tier 3 — modulspecifikke:**
- `shift` + `useShiftResolution`
- `employee_client_assignments`
- `feature_flags` (aktuelt kun 1 aktivt flag: `employee_client_assignments = false`)
- AMO-modul + compliance cron
- Powerdag (`powerdag_events`, `powerdag_point_rules`, `powerdag_scores`)
- Sidebar Menu Editor (`sidebar_menu_config`)

---

## 7. Åbne beslutninger — AI må ikke gætte

Hvor noget af nedenstående er relevant for en opgave: STOP og bed Mathias eller Kasper tage stilling. Foreslå ikke en retning som om den var besluttet.

### Datamodel
- Hvilke data-typer skal have historisk tilstand gemt (team-skift, rolle-skift, løn-snapshots, klient-ejerskab)?
- Formel periode-låsning i DB (ikke kun kode-konvention)
- Strategi for DB-størrelse (arkivering vs. spejling vs. sletning)

### Pricing
- **`product_campaign_overrides`-udfasning.** Tabellen har 76 aktive rækker og læses/skrives via `src/components/mg-test/ProductCampaignOverrides.tsx` + `MgTest.tsx` + `ProductMergeDialog.tsx` + `useKpiTest.ts`. Den er IKKE død. Den læses dog IKKE af pricing-motoren (`rematch-pricing-rules`, `matchPricingRule`). Resultat: nogen kan redigere en override og se ingen effekt. **Slet aldrig denne tabel uden eksplicit plan.** Åben beslutning: (a) slet og migrér til `product_pricing_rules`, eller (b) behold som manuel override-mekanisme?
- **Tie-breaker ved identisk priority.** `ORDER BY priority DESC` uden sekundær nøgle. Ved ens priority er resultatet reelt tilfældigt (Postgres row-ordering). Ingen UNIQUE-constraint forhindrer duplikater.
- Håndtering af manglende subsidy-data fra dialer (kampagne-fallback kan vælge regel vilkårligt)
- Sikring mod drift mellem frontend og edge function-pricing (`_shared/pricing-service.ts` findes, men ingen automatisk diff-test)

### Roller
- Konsolidering af `medarbejder` + `fm_medarbejder_` (96,9% identiske permissions)
- Trailing underscore i `fm_medarbejder_` — bug eller bevidst?
- Erstat hardkodet ejer-bypass (`if (roleKey === 'ejer') return generateOwnerPermissions()` i `usePositionPermissions.ts:266`) med super-admin-flag
- **6 roller har alle `priority = 100`:** ejer, fm_leder, assisterende_teamleder_fm, assisterendetm, fm_medarbejder_, backoffice. Ingen reel prioritets-rangordning mellem dem. Differentieres?
- Dedikerede AMO-ansvarlig/GDPR-ansvarlig/økonomi-ansvarlig roller (EU AI Act + compliance)
- Backoffice-rollens skæbne (0 aktive brugere)
- Konsolidering af de tre identitetslag (role-key, job-title, team-tilknytning)

### Kode-arkitektur
- Centralisering af query keys (stavefejl = stille cache-miss)
- Reduktion af 855 forekomster af `: any`
- Oprydning af 182 efterladte `console.log`
- Testdækning for pricing, cancellation-matching, commission
- Opsplitning af `MgTest.tsx` og `UploadCancellationsTab.tsx`

### Features
- Fejlindberetning på annulleringer fra sælger-lønside
- Notifikation til sælger ved annullering
- GDPR-sletning af kandidater efter konfigureret periode (ikke fuldt automatiseret i dag)
- Vagt-overlap validering i DB-lag (kun UI-valideret i dag)
- Feature flag-cleanup (unified KPI source, employee_client_assignments, hybrid forecast)

---

## 8. Fire strukturelle logikker (læs når opgaven rører nogen af dem)

### Logik 1 — Medarbejder / Sælger / Agent
Tre identiteter parallelt: `employee_master_data`, `agents` (pr. dialer-kilde), `sales.agent_email` (attribution). Koblingen sker via `employee_agent_mapping` (mange-til-mange). **Ingen FK-constraint** sikrer integritet. Navne-resolveren har 4-trins fallback (mapping → work_email → username → agent_email) der kan give samme person to navne i to rapporter. Job-title → role-mapping er hardkodet i `useUnifiedPermissions.ts:124-134` PARALLELT med DB-drevet `position_id → system_role_key`. Dobbelt sandhed.

### Logik 2 — Klient / Brand / Kampagne / Produkt
`clients → client_campaigns → products → product_pricing_rules`. **`brand` står isoleret** uden FK til klient eller produkt — lever kun for FM-booking. To override-mekanismer for kampagnepriser: `product_pricing_rules.campaign_mapping_ids` OG `product_campaign_overrides`-tabellen (sidstnævnte læses ikke af pricing-motoren men er ikke fjernet). Relatel + Eesy har bevidst ingen `effective_from` så rematch ikke bryder historiske data — stiltiende konvention, ikke håndhævet i skemaet.

### Logik 3 — Tidsenheder
`sale_datetime` (timestamptz) = primær tidsstempel. **Lønperiode 15.→14. findes ingen steder som data** — hardkodet i helpers. Uge = `booking.week_number` + `year`. Måned = `client_monthly_goals.year_month` (string `YYYY-MM` — ingen DB-validering af format). **Ingen `period_locks`-tabel.** Tidszone-risiko: salg kl. 23:30 dansk tid kan rapporteres som næste dag i UTC-baserede beregninger. Ved konflikt mellem tidsenheder (retroaktiv rematch efter månedslukning) er der ingen forretningsregel om hvem der vinder.

### Logik 4 — Rolle-arv og rettigheder
10 roller i `system_role_definitions`. Rettigheder i `role_page_permissions` (2303 rækker). Resolveren er `useUnifiedPermissions` / `usePositionPermissions`. **Ejer-bypass er hardkodet** — en ny super-rolle kan ikke oprettes uden kodeændring. **69 hardkodede rolle-referencer i 8 filer.** "Stab" findes som job-title men IKKE som system-rolle (`useStaffHoursCalculation` arbejder via `job_title`-mapping). DB-trigger kollapser 10 roller til 5 for `system_role` enum i RLS-policies — finkornet differentiering forsvinder i praksis. Ingen rolle-audit-trail.

---

## 9. Arbejdsgang i Claude Code

### Før du gør noget
1. Forstå opgaven (princip 15). Hvis uklar: spørg hvorfor.
2. Find zonen (rød/gul/grøn). Ved tvivl: rød.
3. Hvis opgaven rører en åben beslutning (§7): spørg Mathias/Kasper, gæt ikke.

### Før du ændrer en fil
- Læs filen. Læs dens tests hvis de findes.
- Hvis rød zone: rapportér det til brugeren og bed om eksplicit godkendelse med plan.
- Hvis ændringen rører DB-skema: skriv migration. Tjek RLS.
- Hvis ændringen rører pricing eller løn: tjek at frontend + edge fortsat er 1:1.

### Før du committer
- Vi committer og deployer selv. Du skriver ændringerne; vi reviewer og pusher.
- Ingen `console.log` efterladt i prod-kode.
- Ingen nye `: any` medmindre det er Json eller 3rd party.
- Ingen hardkodede rolle-keys (`if (role === 'ejer')`).

### Kommunikationsstil
- Dansk.
- Kort, konkret, highlighted. Start med konklusionen.
- Ved lange svar: TL;DR øverst.
- Én velvalgt spørgsmål ad gangen, ikke ti.
- Konkrete valg, ikke åbne spørgsmål. Ikke "hvad synes du", men "A gør X, B gør Y — hvilket?".
- Ærlig. Også når det er ubehageligt. Udfordr når noget virker galt — spørg ikke om tilladelse først.
- Ingen salgssprog, ingen selvros.

### Prompt-skabeloner

**Analyse (ingen ændringer):**
> Analysér [område]. Ingen ændringer — kun læsning. (1) Hvordan det fungerer i dag. (2) Hvilke filer/tabeller/funktioner styrer det. (3) Hvor logikken er inkonsistent eller hardkodet. (4) Hvilke beslutninger der ikke er truffet.

**Implementation:**
> Implementér [feature]. Tjek zonen først — stop hvis rød. Følg principperne. Rapportér hvilke filer ændres og om der er zone-konflikter.

**Bug-fix:**
> Bug: [beskrivelse]. Find ROOT CAUSE før fix. Foreslå to løsninger: (1) hurtigt fix og (2) grundig løsning. Ingen ændringer før godkendelse.

---

## 10. Hvor du finder mere

- **Dybere rapporter (i Claude.ai-projektet, ikke nødvendigvis i repo):** `system-bibel-v2.docx`, `system-bibel-faktatjek.md`, `no-go-zones-ai-aendringer.md`, `tekniske-principper-bibel.md`, `struktur-rapport-4-logikker.md`, `rolle-struktur-vurdering.md`, `pricing-prioritet-rapport.md`, `arbejdsmoenstre-rapport.md`.
- **Memory-noter:** ~95 stk i Lovable-projektet. Biblen/denne fil er fundamentet; memory-noter er detaljen. Ved konflikt vinder denne fil.
- **Koden selv:** Sandheden om hvad der faktisk sker. Når denne fil og koden er uenige, er koden virkeligheden — men rapportér uenigheden så biblen kan opdateres.

---

*Version 1.0 · April 2026 · Opdateres ved principielle ændringer.*
