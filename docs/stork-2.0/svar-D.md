# Stork 2.0 — anbefalet model

Mit input som ét af fire uafhængige svar. Mathias træffer beslutningen.

---

## 1. Anbefalet model

Jeg anbefaler at bygge Stork 2.0 som en domæne-styret modulær monolit på én Postgres, hvor stammen er et håndhævet kerne-lag og grenene er domæne-pakker bundet sammen af eksplicitte kontrakter — ikke et arkitektur-mønster fra en bog, men en konkret model designet til Storks reelle problem: at logik og identitet driver fra hinanden over tid, og at to partnere skal kunne forstå hver del med AI som arbejdsredskab.

Modellen har fem lag:

**Lag 1 — Kanonisk kerne (stammen).** Én Postgres-database. Tre låste skemaer: `core_identity` (medarbejder, agent-mapping, rolle, team, klient-tildeling), `core_money` (sales, sale_items, commission_transactions, cancellations, payroll_periods, period_locks) og `core_compliance` (audit, consent, retention, ai_governance). Tabellerne i disse skemaer kan kun ændres via migrations review'et af en superadmin. Forretningsregler der findes i bibel-form (lønperiode 15→14, 12,5% feriepenge, oplæringsbonus 750 kr, 35-dages ferie-frist) bor som referenceværdier i en `system_constants`-tabel + i kode-konstanter med assert-test der fejler hvis de driver fra hinanden. Det fixer den nuværende tilstand hvor "lønperiode 15→14 findes ingen steder som data" (`dokument-1-forstaaelse.md` §3.5).

**Lag 2 — Domæne-pakker (grenene).** Hver gren er én mappe (`domains/sales/`, `domains/payroll/`, `domains/recruitment/`, `domains/fm-booking/`, `domains/dashboards/`, osv.) med tre obligatoriske underdele: `repository/` (alt SQL/RPC mod kernen), `service/` (forretningslogik, ren TypeScript) og `ui/` (komponenter + hooks). Komponenter må kun importere fra egen `service/` og fra delte UI-primitiver. En import fra `repository/` til UI eller fra én domænes `service/` til en andens er en lint-fejl der bryder build. Det erstatter dagens tilstand hvor 146 komponenter kalder Supabase direkte (CLAUDE.md §5.10) og hvor pricing-logik findes parallelt i frontend + edge (`storks-logikker.md` logik 1, "Frontend ↔ edge drift").

**Lag 3 — Kontrakt-laget.** Mellem grene må data kun flyde via to mekanismer: (a) læs-kontrakter = navngivne SECURITY DEFINER RPC'er ejet af afgiverens domæne (fx `sales.get_aggregates_v3`), og (b) hændelses-kontrakter = en `domain_events`-tabel med typede payloads (fx `sale.registered`, `sale.cancelled`, `period.locked`, `employee.deactivated`). Pricing-rematch bliver en handler på `sale.registered`, ikke en parallel implementering. Lønberegning lytter på `period.locked` og fryser `commission_transactions`. Det fjerner dagens "manuel 1:1 synkronisering mellem frontend pricing og edge pricing" og det skjulte trigger-net (`enrich_fm_sale`, `create_fm_sale_items`, `validate_sales_email`) som dokument-1 §1.5 beskriver som "en udvikler der læser kun frontend-kode ville aldrig vide".

**Lag 4 — Identitet og adgang.** Tre rene dimensioner som dokument-1 §3.4 og bibel §3 kræver, men håndhævet på DB-niveau:

- Person lever i `core_identity.persons` (én række pr. menneske). Alle eksterne identiteter (work_email, private_email, dialer-emails, dialer-IDs) er rækker i `core_identity.person_identities` med FK til `persons.id`. UNIQUE-constraint på (provider, external_id). Ingen 4-trins fallback i navne-resolveren — der er én vej, og hvis identiteten ikke findes, fejler attribueringen synligt i en "needs_mapping"-kø. Det fjerner dagens tre parallelle identiteter (`employee_master_data`, `agents`, `sales.agent_email`) uden FK-integritet (`storks-logikker.md` logik 8).
- Rolle lever i `core_identity.system_roles` + `role_permissions`. Ingen hardkodede rolle-keys i kode. Superadmin er en attribut på person (`is_superadmin BOOLEAN`) med DB-constraint der forhindrer < 2 aktive superadmins. Det erstatter `usePositionPermissions.ts:266` (`if (roleKey === 'ejer')`) og de yderligere 4 hardkodede ejer-tjek på linje 60, 276, 423, 520 + `useUnifiedPermissions.ts:8, 126, 164`.
- Team lever i `core_identity.teams`, og klient-ejerskab i `core_identity.team_clients` med UNIQUE(client_id) — den nuværende regel fra logik 8 og memory `client-team-exclusivity-and-ownership` bevares, fordi den er rigtig. Sælgers eget team styrer ikke attribution. RLS-policies bygges udelukkende på disse tre dimensioner via `has_role()` og `has_team_access()` SECURITY DEFINER-funktioner — aldrig på rolle-strenge i kode.

**Lag 5 — Integrations-bælte.** Adversus, Enreach, e-conomic, Twilio, M365 lever bag adapters i `integrations/<navn>/`. Hver adapter har én ansvarlighed: oversæt eksternt format til en kanonisk hændelse i `domain_events`. Ingen forretningslogik. Pricing, attribution, validering sker først efter hændelsen er landet i kernen. Dual-dialer-virkeligheden (Adversus + Enreach sender samme salg i forskellige formater) håndteres af to adapters der begge producerer den samme `sale.registered`-hændelse. Det er den samme arkitektur som dokument-1 §2.2 Dimension 3 beskriver som "Entity Resolution / MDM-lag".

**Datamodel-disciplin.** Fire kategorier af data, hver med eksplicit livscyklus:

- Immutable hændelser (sales, sale_items, commission_transactions, cancellations, audit-log, period_locks, login_events, contract_signatures, economic_invoices) — append-only. Rettelser sker via kompenserende rækker med FK til den oprindelige.
- Living masterdata (persons, employees, clients, products, pricing_rules) — kan opdateres, men hver ændring skriver til en `*_history`-spejltabel (fx `pricing_rules_history`). Det formaliserer den nuværende stiltiende konvention om at Relatel + Eesy ikke har `effective_from` (`storks-logikker.md` logik 1, "Vigtige noter").
- Operational data (vagter, bookinger, kandidater) — fri at ændre, ingen historik krævet.
- Konfiguration (`system_constants`, feature_flags, dashboard_layouts) — UI-redigerbar, audit-logget.

Pricing- og lønperiode-modellen kommer ind på et nyt grundlag: lønperioder lever som rækker i `core_money.payroll_periods` med eksplicit `status` (open / calculated / approved / locked). Et `period_locks`-tabel med trigger der blokerer skrivninger i låste perioder. Det fjerner det åbne hul fra `storks-logikker.md` logik 16 ("Ingen `period_locks`-tabel"). Pricing-tie-breaker fixes ved UNIQUE(product_id, priority, campaign_match_mode, campaign_mapping_ids) — det fjerner det nuværende rod hvor identisk priority gør udfaldet til Postgres' fysiske row-order (logik 1, "Tie-breaker mangler"). `product_campaign_overrides` slettes helt; de 76 rækker migreres til `product_pricing_rules` med høj priority. Den åbne beslutning fra CLAUDE.md §7 lukkes ved migration.

Status-modellen fra dokument-1 §3.3 (sales = pending + annulleret + godkendt + afvist; annullering som separat dimension der krydser livscyklus; lønperiode som fryse-punkt) implementeres direkte i skemaet: `sales.registration_status` (enum) + `cancellations` som separat tabel + `commission_transactions` som immutable lønperiode-snapshot. Annullering på et udbetalt salg landes som ny `commission_transaction`-række med negativt beløb i den nye periode — den oprindelige række røres aldrig.

**Compliance er indbygget, ikke bolted on.** Hver tabel med persondata har en `retention_policy_id` FK til `core_compliance.retention_policies`. En cron læser policy + sletter/anonymiserer. Adgang til CPR/bank/kontrakter går gennem en `sensitive_access`-funktion der både returnerer dataen og logger til `sensitive_data_access_log` — ingen direkte SELECT tilladt på de kolonner. EU AI Act håndteres ved at alle AI-kald (Lovable AI, OpenAI) går gennem en `ai_gateway`-edge function der logger use case + ansvarlig rolle.

**Dashboards som selvstændigt modul** (princip 3): `domains/dashboards/` har egen tabel `dashboard_permissions` adskilt fra `core_identity.role_permissions`. TV-link er en pseudonymiseret session-token der peger på samme dashboard-row — ikke en kopi. Det matcher dokument-1 §3.1 "TV-link er spejl af moder-dashboardet".

**UI-styrbarhed** (princip 1) implementeres ved at hver domæne-pakke har en `admin/`-undermappe med superadmin-sider for sin konfiguration. Værdier i `system_constants` redigeres herfra. Beregninger gør ikke. Det er den disciplin dokument-1 §3.1 kalder "Data og værdier = UI. System og beregninger = kode."

---

## 2. Hvorfor netop denne model

**Vedligeholdelig af to partnere med AI.** Modellen har én database, én sproglig stack (TypeScript + SQL), og hver gren er en mappe man kan åbne i sin helhed. AI-værktøjer arbejder bedst når kontekst-grænserne er tydelige — `domains/payroll/` er et naturligt scope for et AI-prompt. Ingen microservices, ingen separate deployments, ingen message-queue at fejlsøge. Det modsatte (event-sourcing med separate read-models eller microservices pr. domæne) ville kræve infrastruktur-kompetencer Mathias og Kasper ikke har og ikke ønsker at opbygge. Den modulære monolit er det enkleste der kan løse problemet uden at blive en stor-ball-of-mud — som 1.0 er på vej til.

**Skalerbar.** Skalering fra 100 til 200+ ansatte kræver ikke arkitektur-ændringer — det er Postgres-skalering, og Supabase håndterer det. Skalering til nye applikationer (uddannelses-miljø, andre forretningsinitiativer) sker ved at tilføje en ny `domains/<navn>/`-mappe der bruger samme kerne. Stamme-grene-modellen fra dokument-1 §2.3 implementeres direkte: stammen er `core_*`-skemaerne plus `integrations/`, grenene er `domains/`. En ny gren arver auth, identitet, audit og UI-primitiver gratis.

**Compliance-sikker.** GDPR-sletning er et eksplicit lag (`retention_policies`), ikke ad hoc. Audit er bygget ind i hver tabel via triggers der skriver til `core_compliance.audit_log`. Bogføringsloven håndteres ved at `economic_invoices` ligger i de immutable hændelser (5 års retention enforced af DB-trigger der nægter DELETE før dato). EU AI Act dækkes af `ai_gateway`-edge functions der logger alle AI-kald. AMO-modulets nuværende disciplin (dokument-1 §1.4 "mest skemadisciplinerede modul") bliver standarden, ikke undtagelsen.

**Håndhævelig over tid.** Det er det vigtigste kriterium og det 1.0 ikke har. Modellen indeholder fem håndhævelses-mekanismer der er bindende, ikke rådgivende — se §3.

---

## 3. Håndhævelses-mekanismer

Det her er hvor 1.0 fejlede ("god intention, ingen håndhævelse" — `PROMPT-fase-2-find-model.md` §"Hvad denne opgave er"). Konkrete tvang:

1. **ESLint-regel der fejler build:** `no-restricted-imports` der forbyder import fra `@/integrations/supabase/client` udenfor `**/repository/**`. Erstatter dagens situation hvor 146 komponenter bryder princip 9 (CLAUDE.md §5.1). Tilsvarende regel forbyder cross-domæne imports fra `service/` til andet domænes `service/`.

2. **DB-constraints der ikke kan omgås fra UI:** UNIQUE på `(product_id, priority, campaign_match_mode, campaign_mapping_ids)` for pricing. CHECK-trigger på `payroll_periods` der nægter UPDATE/DELETE på rækker med `status = 'locked'`. CHECK-trigger på `persons` der nægter at antallet af aktive superadmins falder under 2. CHECK-trigger på `team_clients` UNIQUE(client_id). RLS-policies der bruger `has_role()` SECURITY DEFINER — aldrig hardkodede roller i policy-tekst.

3. **Drift-detector i CI:** En test-fil der parser hver helper-konstant (lønperiode-grænser, feriepengesats, oplæringsbonus, ferie-frist) og sammenligner med `system_constants`-tabellen. Mismatch = build fejler. Det fanger den drift som dokument-1 §1.5 advarer om: "Frontend- og edge-pricing holdes 1:1 manuelt — ingen automatisk diff-test fanger drift".

4. **Kontrakt-snapshot i CI:** Hver navngivet RPC + dens response-shape committet til `docs/contracts.md`. Ændring kræver eksplicit migration + version-bump. En forbruger kan ikke pludselig brækkes af en silent kerne-ændring.

5. **AI-arbejdsregel skrevet ind i CLAUDE.md** (allerede etableret): Rød zone-filer kræver eksplicit godkendelse. Modellen tilføjer at `core_*`-skemaer er rød zone pr. definition + at kontrakter (RPC'er + events) er rød zone. AI-byggere kan ikke ændre dem uden at det opdages i review.

Disse fem mekanismer betyder at en AI-bygger der "glemmer" arkitekturen fysisk ikke kan committe en komponent der kalder Supabase direkte, ikke kan tilføje en hardkodet rolle-key uden at lint fejler, og ikke kan ændre en låst lønperiode uden at DB siger nej.

---

## 4. Risici og blinde pletter

**Migration-byrden er reel.** Modellen kræver at de tre identiteter konsolideres til `persons` + `person_identities` med ægte FK'er. Det er ikke en lille opgave, og hvis migrationen er mangelfuld, mister man attribution på historiske salg. Jeg har ikke designet migrations-strategien — det er fase 3.

**Domæne-grænser er aldrig perfekte.** Pricing er "egen domæne" men læses af både sales og payroll. Cancellations krydser sales og payroll. Hvis kontrakt-laget bliver for tungt, ender man med at hver feature kræver tre PR'er. Modgift: start med få, brede grene (sales, payroll, identity, integrations) og split først når smerten er konkret. Antagelsen om at fire-fem grene rækker, kan vise sig forkert.

**`domain_events` kan blive en anti-pattern hvis den misbruges.** Hvis grene begynder at lytte på events for at undgå at kalde RPC'er direkte, ender man med implicit kobling der er værre end dagens. Reglen skal være: events bruges kun til ægte side-effekter (rematch pricing, audit, notifikation). Synkrone læsninger går via RPC.

**Postgres som single point of failure.** En enkelt fejl-migration kan ramme alt. Modgiften er backup + staging-miljø, men det er driftsdisciplin Stork ikke har dokumenteret i dag.

**`system_constants` kan blive et nyt UI-rod.** Hvis superadmin kan redigere "lønperiode-startdag" i UI, og det redigerer det reelle systemkonstant uden assert-test, har vi flyttet rodet. Modgiften er at konstanter er read-only for ikke-superadmins og at en assert-test sammenligner DB-værdi mod kode-konstant ved boot. Det skal designes præcist.

**Jeg har ikke verificeret påstande om `domain_events` performance** ved Storks volumen (~100 brugere, ukendt antal salg pr. dag). Hvis volumen vokser 10x, kan event-tabellen blive en flaskehals der kræver partitionering. Antagelse, ikke målt.

**Den åbne beslutning om `product_campaign_overrides`** (CLAUDE.md §7) gætter jeg på i mit forslag (slet og migrér). Det er en beslutning Mathias bør træffe, ikke jeg.

---

## 5. Hvad jeg ikke har taget stilling til

- Migrationsvej fra 1.0 til 2.0. Big-bang vs. inkrementel strangler-pattern. Det er fase 3.
- Nøjagtig mapping af 25 moduler til grene. Jeg har skitseret ~5 grene; den fulde mapping kræver workshop.
- Hvordan dialer-rate-limits og webhook-retry håndteres i integrations-bæltet. Adversus rate-limit-runbook eksisterer, men jeg har ikke læst den dybt.
- Hvordan TV-board-anonym session præcist implementeres under nye RLS-regler.
- Om Twilio softphone og M365-kalender skal være egne grene eller del af "kommunikation".
- Hvordan eksisterende memory-noter (~95) konsolideres ind i kode + DB-schema vs. arkiveres.
- Hvilken Postgres-extension der skal håndtere `domain_events` (LISTEN/NOTIFY, pg_cron-poll, eller noget tredje).
- Hvor `transactions`-tabellen passer ind — den åbne beslutning fra CLAUDE.md §7 er ikke besvaret.
- Eksakt rolle-konsolidering (de seks roller med priority=100, fm_medarbejder_-trailing-underscore, "stab" som job_title vs. rolle).

Disse er beslutninger Mathias og Kasper bør træffe — ikke som AI bør gætte.

---

## 6. Alternativer jeg fravalgte

**Microservices pr. domæne** (egen DB pr. service + REST/gRPC mellem dem). Ville give stærkere isolation og mulighed for at skalere grene uafhængigt. Fravalgt fordi: to partnere kan ikke vedligeholde en distribueret arkitektur. Hver service kræver egen deployment, eget monitoring, egen backup. Eventual consistency mellem sales-DB og payroll-DB ville gøre lønberegning et mareridt. Distribueret transaction = distribueret problem. Stork har 100 brugere, ikke 100 millioner.

**Event sourcing + CQRS som primær model.** I stedet for tabeller med rækker, ville hele systemet være en strøm af hændelser, og enhver tilstand projicerer fra dem. Teoretisk ren, og det matcher status-modellen fra dokument-1 §3.3 elegant. Fravalgt fordi: rebuilding read-models fra millioner af hændelser ved schema-ændring er en operation Mathias og Kasper ikke har erfaring med. Debugging af "hvorfor viser dashboardet det her tal" bliver markant sværere når svaret er "det er en sum over 200.000 events filtreret af 14 projektioner". Modellen jeg foreslår bruger hændelser hvor det giver værdi (cross-domain side-effekter), men holder primær state i normaliserede tabeller.

**Hexagonal / "Clean Architecture"** med strenge ports & adapters i hver gren. Fravalgt fordi: navnet er pænt, men implementationen kræver typisk 3-4x flere filer pr. feature (entity, port, adapter, use-case, DTO, mapper). Det er den slags arkitektur der ser god ud i en blogpost og bliver ignoreret efter 6 måneder. Min model tager den værdifulde del (`repository/service/ui`-tre-deling) uden ceremonierne.

---

## 7. Proces-rapport

Jeg læste i denne rækkefølge: `PROMPT-fase-2-find-model.md` først for at forstå hvad der spurges om → `bibel.md` (kort, principper) → `dokument-1-forstaaelse.md` i to dele (især §1.5 problemer, §2 vision, §3.3 status-model og §3.4 rettigheds-tænkning) → `stork-logikker-til-gennemgang.md` (hele dokumentet — Mathias' egen tænkning, vigtigere end den mekaniske beskrivelse) → udvalgte sektioner af `storks-logikker.md` (logik 1 pricing, 3 commission, 5 leder-løn, 8 sales_ownership, 10 employee_client_assignments, 16 payroll_period). CLAUDE.md var allerede i context, så jeg slog op i §4 (zone-regler), §5 (mønstre), §7 (åbne beslutninger). Cross-reference brugte jeg til at se omfanget af tabel-kobling. Jeg verificerede konkrete linjenumre i `usePositionPermissions.ts` og `useUnifiedPermissions.ts` med ripgrep, så ejer-bypass-citaterne ikke er hukommelse.

Mest tænke-tid brugte jeg på spændingen mellem to ting: dokument-1 §3.3's status-model (der peger mod event-sourcing) og bibel/CLAUDE.md's krav om at to partnere kan vedligeholde systemet (der peger mod simpel monolit). Mit første udkast lænede ind i event-sourcing fordi det var elegant. Jeg skrottede det da jeg testede mod kriteriet "vedligeholdelig af to partnere" — debugging af projektioner uden senior-udvikler er ikke en realistisk drift. Anden iteration var en ren CRUD-monolit, men den fejlede mod kriteriet "håndhævelig over tid" — det er præcis hvad 1.0 er. Den endelige model er hybriden: normaliserede tabeller som primær state + `domain_events` til cross-domain side-effekter + fem konkrete håndhævelses-mekanismer.

Kernen i anbefalingen tippede da jeg læste `stork-logikker-til-gennemgang.md` §10's præcisering om at "pile er farlige — grupperinger viser HVAD ting er, IKKE hvordan de hænger sammen". Det er den indsigt der gør at modellen ikke er hierarkisk men derimod et sæt af domæne-pakker bundet af eksplicitte kontrakter. Sammenhænge lever i kontrakterne, ikke i organisationen.

Mindst tilfreds er jeg med §3 håndhævelses-mekanismer. De fem mekanismer er rigtige men jeg har ikke designet dem konkret nok til at vurdere om de samlet er nok. ESLint-reglen er triviel; CI drift-detector og kontrakt-snapshot er reelt arbejde at bygge. Jeg har også taget en genvej ved at gætte på `product_campaign_overrides`-skæbnen i selve modellen i stedet for at lade den være åben. Og jeg har ikke kunnet citere lige så konkret fra `system-snapshot.md` som jeg burde — den er 360.000 linjer, og jeg har ikke åbnet specifikke RPC-bodies. Hvis Mathias sammenligner med svar der citerer dybere fra snapshot-filerne, vinder de på det punkt.

Modellen er ikke "stamme-og-grene fra biblen i en pænere indpakning" — den er et konkret bud på hvordan stamme-grene-tænkningen fra dokument-1 §2.3 implementeres så den kan håndhæves. Hvis Mathias finder noget bedre i de andre tre svar, skal han ikke vælge dette.
