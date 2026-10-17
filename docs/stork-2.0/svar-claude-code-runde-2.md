# Stork 2.0 — runde 2 svar

Mit svar i runde 1 var **svar-B** (verificeret via `git log` på `claude/stork-2-0-review-2VF7y`-grenen). Jeg er Claude Code (Opus 4.7).

---

## Hvor jeg skifter mening

1. **Stammen i datalaget skal være tre eksplicit låste schemas, ikke fire abstrakte lag.** D's `core_identity / core_money / core_compliance` er en bedre organiserende metafor end mit oprindelige "fire lag". Lag er teknisk; schemas er ejerskab håndhævet af Postgres. Det gør "rød zone" til en konkret schema-grænse i stedet for en mappe-konvention. Jeg overtager strukturen.

2. **"Kontraktstyret" er den rigtige framing.** C navngiver det mit svar implicit antog: at adgang mellem grene sker via navngivne, versionerede kontrakter. Mit oprindelige svar talte om gateway og services men kaldte dem aldrig kontrakter. Forskellen er ikke kosmetisk — kontrakter har snapshot-tests og version-bumps. Det er en mekanisme.

3. **A's håndhævelses-katalog er bredere end mit.** Konkret: snapshot-pligt i CI (PR der ændrer skema men ikke regenererer `docs/system-snapshot.md` afvises) og domæne-CLAUDE.md (hver gren har egen). Mit svar havde tekniske gates men manglede dokumentations-disciplinen. Tager dem ind.

4. **Pricing tie-breaker skal være UNIQUE-constraint, ikke kun deterministisk sortering.** D's `UNIQUE(product_id, priority, campaign_match_mode, campaign_mapping_ids)` forhindrer at duplikater overhovedet eksisterer — stærkere end at sortere dem reproducérbart. Jeg havde lignende, men D's version er præcis.

## Hvor jeg holder fast

1. **Beregninger lever i delt TypeScript-pakke (`@stork/core`), ikke i Postgres-RPC'er.** A argumenterer at drift kun forsvinder når der kun er ét sted, og at Postgres er det ene sted. Forkert konklusion fra rigtig præmis. En delt TypeScript-pakke er også ét sted — bare i et sprog som både edge og frontend importerer 1:1. Runde 2's præmis er **konsolidering, ikke omtænkning**. Pricing eksisterer i dag i TypeScript begge steder. Konsolidering = importer fra ét sted. Konvertering til PL/pgSQL er rewrite til et sprog hvor AI-byggere er svagere, hvor unit-tests er en investering 1.0 ikke har, og hvor pricing-prioritets-logikken bliver markant sværere at læse. A's eneste stærke modargument er testbarhed — men shared TypeScript-pakke giver bedre testbarhed end PL/pgSQL, ikke dårligere.

2. **Synkron RPC primært. Ingen ny `domain_events`-tabel som infrastruktur.** D foreslår eksplicit asynkrone events for cross-domain side-effekter. Det er elegant men det er ekspansion, ikke konsolidering. Valg af mekanisme (LISTEN/NOTIFY vs pg_cron-poll vs outbox) er selv en designbeslutning der kræver kapacitet vi ikke har. Pricing-rematch kører allerede synkront via `rematch-pricing-rules`-edge-function; det er fint så længe den kaldes via en navngivet kontrakt. Trigger-spaghettien D korrekt identificerer (`enrich_fm_sale`, `create_fm_sale_items`, `validate_sales_email`) skal forsvinde — men ved at flyttes til navngivne RPC'er kaldt eksplicit fra pipelines, ikke ved at flyttes til et nyt event-system. Cross-session sync er en eksisterende mekanisme (`mg-test-sync`) der bare skal have typed keys.

3. **Eksplicitte livscyklus-state-machines i datalaget er det manglende koncept i alle fire svar.** A nævner status-modellen kort. C har "livscyklusregistre". D har lifecycle for sales og pay_periods. Men ingen gjorde det til *kerne-konceptet*. Mit argument: det er præcis hér 1.0 falder fra hinanden — pay_period er kode-konvention, sale-status er implicit i hooks, pricing-livscyklus mangler. Hvis tilstand er eksplicit data, fejler RLS når andet end den autoriserede vej prøver at ændre den. Hvis tilstand er konvention, smuldrer den.

## De tre uenigheder — eksplicit stillingtagen

### a. Hvor lever beregninger? — **Delt TypeScript-pakke (`@stork/core`)**

**Mod A (PL/pgSQL-RPC'er):** Premissen er konsolidering. Beregningerne eksisterer allerede i TypeScript begge steder; PL/pgSQL er rewrite. Tilkomstens omkostning (PL/pgSQL test-stack, AI-byggernes svagere kompetence, pricing-prioritet udtrykt som SQL bliver sværere at læse) er stor. Drift-problemet løses ligeså effektivt af én delt pakke som af én RPC.

**Mod D (TypeScript-service per domæne i `repository/service/ui`):** Risikoen for inter-domæne drift. Hvis `domains/payroll/service/` har en pricing-helper og `domains/sales/service/` har en pricing-helper, er vi tilbage ved 1.0's grundproblem med pænere mappe-navne. Én delt pakke gør det fysisk umuligt at have to versioner.

### b. Hvor smal er stammen? — **Smal: tre låste schemas + den delte beregnings-pakke**

**Mod A (bred: 8 lag inkl. organisation, klient, integration som stamme-domæner):** For mange ting kaldt "stamme" betyder intet er stamme. Schema-låsning virker kun på en lille kerne hvor overtrædelse er entydig. Hvis "klient" er stamme, hvad gør man når en klient-app skal udvide klient-modellen?

**Mod C (bred stamme med 6 ting inkl. "service-lag og UI-kontrakter"):** Service-lag og UI-kontrakter er gateway, ikke stamme. Stammen er hvad der er sandt på tværs af grene — data og beregning. Service-laget *håndhæver* stammens grænser; det er ikke selv stammen. C's intention er rigtig (alt skal være kontraktstyret), men placeringen er forkert.

### c. Domain events: ja eller nej? — **Nej. Synkron RPC primært**

**Mod D:** Domain events er ekspansion ikke konsolidering. De løser et koblings-problem (synlige side-effekter) som ikke er Storks hoved-problem. Hoved-problemet er at logik driver fra hinanden — det løses af at logikken bor ét sted. Eventerne tilføjer en mekanisme der skal designes, observeres, fejl-håndteres, retries og idempotency-sikres. Det er bevidst-uundgåelig kompleksitet for to partnere uden DevOps-team. Den enkleste løsning er at navngive de RPC'er der allerede findes, og gøre dem til entydige indgange. Hvis pipelines vokser sig så komplekse at synkrone kæder bliver sårbare, kan en `domain_events`-tabel tilføjes som fase 4 uden at bryde modellen.

---

## Revideret model — i samme format som runde 1

### 1. Anbefalet model

Stork 2.0 bygges som **én monolit med tre låste schemas i datalaget, en delt beregnings-kerne i TypeScript, en kontraktstyret gateway og pluggable apps**. Eksplicit livscyklus-state-machines på kerne-objekter er første-klasses koncept i datamodellen.

**Lag 1 — Datalaget. Tre låste schemas + applikations-schemas.**

- `core_identity` — `persons`, `person_identities` (FK til persons; UNIQUE(provider, external_id)), `employees`, `teams`, `team_clients` (UNIQUE(client_id)), `system_roles`, `role_permissions`, `employee_roles`, `system_superadmins` (DB-trigger forhindrer count < 2). Ingen 4-trins fallback i identity-resolveren — ét opslag, fejler synligt i en `needs_mapping`-kø hvis identiteten ikke findes.
- `core_money` — `sales`, `sale_items`, `commission_transactions` (immutable; rettelser via kompenserende rækker), `cancellations` (separat dimension), `pay_periods` (eksplicit livscyklus: `open → snapshot → approved → paid → closed`), `period_locks`, `pricing_rules` (livscyklus: `draft → active → retired`) med `UNIQUE(product_id, priority, campaign_match_mode, campaign_mapping_ids)`, `pricing_rules_history`. RLS-trigger der nægter mutationer i låst periode.
- `core_compliance` — `audit_log`, `retention_policies`, `consent_log`, `gdpr_cleanup_log`, `sensitive_data_access_log`, `ai_instruction_log`, `economic_invoices` (immutable; 5-års-DB-trigger), `amo_audit_log`. Hver persondata-tabel i andre schemas har FK `retention_policy_id`.

Default deny på alt RLS. Migration der opretter tabel uden eksplicit policy fejler i CI. `enable_audit('table_name')`-funktion attacher trigger og indsætter i `audited_tables`-register.

Apps har egne tabeller i schema `app_<navn>`. De må ikke skrive direkte i `core_*`-schemas — kun via SECURITY DEFINER RPC'er ejet af det respektive core-schema.

**Lag 2 — Kerne-beregninger. Delt TypeScript-pakke `@stork/core`.**

Importeres identisk af edge functions (Deno) og frontend (Vite/React). Pure functions, ingen DB-adgang, ingen IO:

- `pricing.match(input)` — den ene autoritative pricing-funktion.
- `salary.compute(input)` — løn-aggregation pr. medarbejder pr. periode.
- `identity.resolve(input)` — én resolver. Returnerer eksplicit `Unresolved` hvis input ikke kan resolves.
- `period.from(date)`, `period.status(periodId)` — periode-helpers.
- `attribution.team(saleInput)` — bevarer `team_clients`-vejen.
- `permissions.has(userContext, key)` — permission-resolution som ren funktion.

Pakken er TypeScript skrevet i en delmængde der bundle'r til både Deno og Node. Konstanter (lønperiode 15→14, 12,5% feriepenge, 750 kr oplæringsbonus, 35 dages frist, ASE 400/1000) er kode-konstanter med assert-test der sammenligner mod `system_constants`-tabellen ved boot. Mismatch = boot fejler.

**Lag 3 — Gateway. Den ene tilladte indgang fra UI til data.**

`src/services/<domain>/` på frontend, `supabase/functions/_gateway/<domain>/` på edge. Det eneste sted der må importere `@/integrations/supabase/client` eller skrive til `core_*`. Hver gateway-metode har en navngivet, versioneret kontrakt. Kontrakter er commited i `docs/contracts.md` og snapshot'es i CI. Ændring kræver migration + version-bump.

**Lag 4 — Apps (Mathias' grene).**

`src/apps/<navn>/{routes, components, hooks, types}` + `app_<navn>`-schema i DB. Apps kommunikerer kun via gateway og `@stork/core`. Foreløbig liste fra dokument-1 §10: salg, løn, dashboards, FM-booking, rekruttering, onboarding, AMO/GDPR, e-conomic, gamification, kontrakter, kommunikation. Ny app er ny mappe + nyt schema; den arver alt under den.

**Lag 5 — Integration-bælte.**

Hver kilde (Adversus, Enreach, e-conomic, Twilio, M365) har én adapter under `supabase/functions/_adapters/<kilde>/`. Pure function fra rå payload til kanonisk DTO + et synkront kald til den relevante navngivne RPC i `core_*`. Ingen forretningslogik. Råpayload bevares i `integration_events` (immutable). Pricing-rematch er en navngivet RPC (`pricing.rematch_for_sale(saleId)`) kaldt synkront af adapteren efter `record_sale` — det erstatter dagens implicitte trigger-net.

**Tværsnit — compliance.** Ikke et lag, men automatik. Hver persondata-tabel har `retention_policy_id`. Hver SECURITY DEFINER-RPC der returnerer sensitive felter logger til `sensitive_data_access_log`. EU AI Act: AI-byggere skriver til `ai_instruction_log` via standard pre-commit-webhook.

**Identitet × team × rolle som tre rene dimensioner.** Permissions = `permissions(key)` × `roles(key)` × `role_permissions(M:M)` × `employee_roles`. FM-tilhør udtrykkes via team, ikke rolle. `medarbejder` og `fm_medarbejder_` (96,9% identiske, logik 14) konsolideres til én rolle. Superadmin er separat tabel; `usePositionPermissions.ts:266` (`if (roleKey === 'ejer')`) udgår.

**Livscyklus-dimensioner som første-klasses koncept.** Salg, lønperiode, identitet, pricing-regel, kandidat. Fem state machines, modelleret eksplicit i DB.

**Dashboards** har eget rettighedssystem (besluttet princip 3) men genbruger stammens audit, RLS-fundament og kontrakter. TV-link er pseudonymiseret session-token der peger på samme dashboard-row.

### 2. Hvorfor netop denne model

**Vedligeholdelig af to partnere med AI.** Tre låste schemas + én delt pakke + én gateway. Hver gren er en mappe + et app-schema. AI-prompts har naturligt scope ("tilføj feature X til app løn" = `src/apps/loen/` + relevant gateway-metode). Den eneste viden der ikke kan udledes fra strukturen er forretningsregler, og dem er der ~15 af. PL/pgSQL ville være modellen der blev sværere at vedligeholde, ikke nemmere — det er det centrale punkt mod A.

**Skalerbar.** Ny gren = ny mappe + nyt app-schema. To nye klienter med forskellige salgsflows er konfigurations-rækker i `client_campaigns` + ny adapter — ikke ny kodebase. 200+ ansatte rammer Postgres compute, ikke arkitekturen.

**Compliance-sikker.** Retention-policy som FK gør GDPR-sletning til konfiguration. Audit-trigger automatisk på rød zone. Bogføringsloven er DB-trigger på `economic_invoices`. EU AI Act er pre-commit-webhook + `ai_instruction_log`. AMO bevares som-er.

**Håndhævelig over tid.** Forskellen mellem 1.0 og 2.0 er at modellens regler er kodet ind i type-systemet, RLS, ESLint, CI og DB-constraints. Du kan ikke skrive en komponent der kalder Supabase direkte uden CI fejler. Du kan ikke tilføje en pricing-regel uden tie-breaker fordi UNIQUE-constraint'en blokerer. Du kan ikke skrive `if (role === 'ejer')` fordi der ikke findes en `role`-streng at sammenligne med — der er en typed `permissions.has()`-funktion.

### 3. Håndhævelses-mekanismer

1. **Genererede typer fra DB-skemaet.** `PermissionKey`, `RoleKey`, `PageKey`, `QueryKey` som union-typer. Stavefejl = compile-fejl. De 69 hardkodede rolle-referencer (logik 13) bliver compile-fejl.

2. **ESLint custom rule: no-direct-supabase.** Forbyder import af `@/integrations/supabase/client` udenfor `src/services/`. CI fejler. Adresserer de 274 filer (C's tælling) der bryder princip 9.

3. **CI fitness-funktioner.** Tæller `: any` (855 i dag), `console.log` (182), hardkodede rolle-keys (69). Fejler hvis tallet stiger.

4. **RLS default deny + migration-gate.** Tabel uden RLS-policy = migration fejler. `enable_audit()` kaldes automatisk for tabeller der matcher rød-zone-mønstre.

5. **Pricing-konsistens-test.** Ren TypeScript-test af `pricing.match()` med matrix af cases. CI kører den i begge runtimes (Deno + Node) for at fange bundling-fejl.

6. **Periode-låsning som DB-constraint.** Når `pay_periods.status = 'paid'`, RLS nægter UPDATE/INSERT på `commission_transactions WHERE period_id = ?`.

7. **UNIQUE-constraints på pricing.** Tie-breaker er irrelevant fordi duplikater er fysisk umulige.

8. **App-isolation via folder-imports.** ESLint: en app må ikke importere fra en anden app. Hvis `apps/loen` skal bruge noget fra `apps/salg`, skal det op i `services/` eller `@stork/core`.

9. **Snapshot-pligt** (overtaget fra A). PR der ændrer skema men ikke regenererer `docs/system-snapshot.md` afvises.

10. **Domæne-CLAUDE.md** (overtaget fra A). Hver app har egen `CLAUDE.md` der beskriver hvad den ejer, hvilke kontrakter den eksponerer og forbruger.

11. **Kontrakt-snapshot i CI** (overtaget fra C). Hver gateway-metode + RPC + response-shape committet til `docs/contracts.md`. Ændring kræver migration + version-bump.

12. **Kode-duplikation-detector.** jscpd eller sonarcloud i CI. Fanger Lovable-mønstret hvor kode kopieres mellem komponenter i stedet for at importeres.

13. **AI-handlings-logging.** Alle AI-byggere skriver til `ai_instruction_log` via standard pre-commit-webhook. EU AI Act dækket strukturelt.

14. **Append-only zone-register.** Pre-commit-hook kræver "ZONE: red"-prefix i commit-message for ændringer i `core_*`-schemas eller pricing/permissions/lønberegnings-filer.

### 4. Risici og blinde pletter

**`@stork/core` bundling fra TypeScript til både Deno og Node.** Min model afhænger af at det fungerer smertefrit. Hvis det ikke gør, falder vi tilbage til 1.0's manuelle 1:1-vedligeholdelse — uacceptabelt. Mod-foranstaltning: pakken skrives bevidst i en delmængde der er kompatibel med begge runtimes, og CI bygger og kører pakken i begge runtimes obligatorisk fra dag ét. Men jeg har ikke verificeret bundling-vejen empirisk. Det er den enkelte risiko jeg er mest nervøs for.

**Migrations-vejen er ikke triviel.** `persons` + `person_identities`-flytning berører hver `sales`-række. På 100+ daglige brugere kan det ikke ske online uden planlagt blokering. Fase 3, men en risiko at modellen overhovedet er gennemførlig under drift.

**At fravælge `domain_events` kan være forkert hvis pipelines bliver komplekse.** Adversus → record_sale → rematch_pricing → recalculate_commission → notify_seller er en lang synkron kæde. Hvis kæden vokser, kan asynkrone events vise sig nødvendige. Min mod-foranstaltning er at hver RPC er idempotent og kan retries; pipelines kører i transaktion når muligt. Hvis det ikke holder, kan en `domain_events`-tabel tilføjes som fase 4 uden at bryde modellen.

**Default deny RLS er aggressivt.** Mange eksisterende edge functions kører med `verify_jwt = false` (Adversus-webhook) og kalder med service role. Service role skal stadig kunne skrive; auth-brugere kun det permission-systemet tillader.

**Antal apps er en designvariabel.** Foreløbig liste på ~10 apps fra dokument-1 §10. Workshop med Mathias og Kasper kræves før modellen er fuldt designet. C har ret i at "Marketing" og "Rekruttering" muligvis er én.

**`product_campaign_overrides` skæbne** er Mathias' beslutning. D gætter (slet og migrér); jeg gætter ikke. Åben i CLAUDE.md §7.

**Modellen forudsætter at AI-genereret kode kan respektere lag-grænser.** Lovable er kendt for at tage den korte vej. ESLint fanger det, men det skaber friktion. Hvis Lovable konsekvent bryder reglerne på trods, er modellen ikke gennemførlig med Lovable som hovedmotor.

**De seks priority=100-roller** (CLAUDE.md §7) skal differentieres eller konsolideres før schema fryses.

### 5. Hvad jeg ikke har taget stilling til

- Migrations-strategi (fase 3).
- Antallet og afgrænsningen af apps (workshop-emne).
- Hvorvidt FM-booking smelter sammen med Salg når Brand-dimensionen udfases.
- Strategi for arkivering af gamle salg. Skalerbarhed mod 200+ ansatte er data-volumen, ikke arkitektur.
- Multi-superadmin-godkendelse for kritiske handlinger.
- `product_campaign_overrides` skæbne (Mathias' beslutning).
- `employee_client_assignments` som adgang vs. attribution. Åben i dokument-1.
- Real-time vs. polling for cross-session updates ved 200+ samtidige brugere.
- `transactions` vs. `commission_transactions` (åben i CLAUDE.md §7).
- Backup/restore RTO/RPO for løn-systemet.
- Migration-kontinuitet under drift (big-bang vs. inkrementel strangler).

### 6. Alternativer fravalgt

**A's PL/pgSQL-RPC som primært logik-sted.** Fjerner drift-problemet ligeså effektivt som en delt pakke (ét sted). Fravælges fordi: PL/pgSQL er rewrite ikke konsolidering; testing er en investering; AI-byggere er svagere i PL/pgSQL; pricing-prioritet udtrykt som SQL er sværere at læse. A's mitigation (pgTAP) er en investering der ikke betaler sig hvis shared TS-pakke giver samme garanti.

**D's `domain_events`-tabel som primær infrastruktur for cross-domain side-effekter.** Fravælges fordi: ekspansion ikke konsolidering; valg af mekanisme (LISTEN/NOTIFY vs pg_cron-poll vs outbox) er en designbeslutning der kræver kapacitet vi ikke har; den synkrone alternativ (navngivne RPC'er kaldt fra pipelines) løser samme problem (eliminerer trigger-spaghetti) uden ny infrastruktur.

**C's brede stamme inkl. service-lag og UI-kontrakter.** C har ret i kontrakt-tankegangen — men service-lag og UI-kontrakter hører til gateway og grene, ikke stamme. Stammen er data og beregning der er sandt på tværs.

**Microservices.** To partnere kan ikke vedligeholde distribueret arkitektur.

**Event sourcing + CQRS.** Kompleksitet for at løse problem vi ikke har. Vi har brug for "se hvad blev udbetalt 14. marts og hvorfor" — løses med immutable `commission_transactions` + audit-log.

**Hexagonal/Ports-and-adapters.** Ceremonien (interface for alt, dependency-injection-frameworks, mappers) er overkill.

**Klassisk stamme-og-grene uden kontrakter.** Det er effektivt 1.0's intention; den smuldrede fordi konvention ikke håndhæves.

### 7. Proces-rapport — hvad ændrede sig

Læsningen i runde 2: prompten → svar-A → svar-C → svar-D (jeg sprang min egen B over) → tilbage til prompten for at sikre alle fem punkter blev besvaret. Verificerede mit B med `git log` på `claude/stork-2-0-review-2VF7y` og fandt commit `f322876d` "tilføj Claude Codes fase 2-svar".

**Hvor kernen tippede.** A's argument for Postgres-RPC tvang mig til at gen-besøge mit valg af shared TypeScript-pakke. A's formulering er fyldig: ét sted, ingen frontend/edge-drift, tættere på data. Jeg testede mod runde 2's eksplicitte præmis ("konsolidering, ikke omtænkning") og kom ud med samme konklusion som runde 1 — men nu skarpere: en delt TypeScript-pakke er ligeså meget "ét sted" som en RPC, og det er konsolidering frem for rewrite.

D's tre låste schemas tippede mig til at omformulere mit lag-1. Jeg havde "Postgres er sandheden, fasebaseret" — D konkretiserede det til `core_identity / core_money / core_compliance`. Schema-grænser er noget Postgres rent faktisk kan håndhæve. Jeg overtog konceptet.

C's "kontraktstyret" tippede mig til at gøre kontrakterne eksplicitte i håndhævelses-mekanismerne. Mit svar i runde 1 havde gateway og services, men kaldte dem ikke kontrakter. Forskellen er at kontrakter har versionering og snapshot-tests.

**Hvor jeg holdt fast.** Beregningssprog (TypeScript over PL/pgSQL) og synkron-først (intet domain_events-system). De argumenter A og D fremfører er rigtige om problemet, men deres løsninger er større end Storks reelle problem. Premissen om konsolidering var afgørende — flere gange tjekket mod den.

**Mest tænke-tid** brugte jeg på spørgsmålet om jeg skulle adoptere D's `domain_events`. Den invisible coupling i 1.0's triggers er ægte. Men at indføre event-infrastructure er en ny mekanisme. Den synkrone alternativ — navngivne RPC'er kaldt fra pipelines — løser samme problem med mindre kompleksitet. Jeg lader døren stå åben i fase 4 hvis pipelines vokser sig komplekse.

**Hvor jeg er mindst sikker.** Tre punkter, specifikt:

1. **`@stork/core` bundling mellem Deno (edge) og Vite/Node (frontend).** Min model er afhængig af at det fungerer smertefrit. Jeg har ikke verificeret det empirisk. Hvis det ikke fungerer, kollapser modellens centrale fordel.

2. **Domain-mapping til de 16 moduler i dokument-1 §10.** Min liste på ~10 apps er foreløbig. Salgsvalidering, dialer-rate-limit, M365-integration kunne placeres flere steder. Forkert placering = nye hot spots i 2.0.

3. **At fravælge `domain_events` kan være forkert hvis pipelines bliver komplekse.** Adversus → record_sale → rematch_pricing → recalculate_commission → notify_seller er en lang synkron kæde. Hvis den vokser, kan asynkrone events vise sig nødvendige. Min mod-foranstaltning er at lade modellen kunne udvides senere uden at bryde kontrakter, men jeg har ikke designet den udvidelse.

Mindst tilfreds er jeg fortsat med min compliance-tværsnit-beskrivelse. "Automatik", "FK på persondata-tabeller", "audit-trigger automatisk" — men ikke designet til konkrete politik-typer (hvilke retention-perioder; hvordan anonymisering håndteres for `commission_transactions` der skal bevares men have person-data fjernet; hvordan kontrakt-signaturer relaterer til persondata vs bevismateriale). For skitseret til implementering uden yderligere design.
