# Svar — Claude Code · Fase 2 (Stork 2.0 model)

**Aktør:** Claude Code (sonderet på `origin/main`, branch `claude/stork-2-0-review-2VF7y`)
**Dato:** 6. maj 2026
**Status:** Uafhængigt input. Ikke koordineret med Claude.ai, Lovable eller Codex.

---

## 1. Anbefalet model

Stork 2.0 bygges som **én monolit med fire skarpt adskilte lag og en synlig kerne af forretningsobjekter med eksplicit livscyklus**. Mathias' stamme/grene-billede holder, men "stammen" er ikke selv en gren — det er det fundament som alle grene konsumerer. Modellen kan beskrives i fire lag plus en tværgående compliance-væv.

**Lag 1 — Datalaget.** Postgres er sandheden, og sandheden er fasebaseret. Hver kerne-stamme får en eksplicit state machine i skemaet, ikke kun et status-felt:

- `sales` har faserne *optaget → beriget → godkendt*, plus annullering som separat dimension. Status-skift sker via stored procedure med før/efter-tjek; direkte UPDATE blokeres af RLS undtagen via SECURITY DEFINER-funktioner.
- `pay_periods` bliver en rigtig tabel med status `open → snapshot → approved → paid → closed`. Når status er `paid`, blokerer RLS mutations på `commission_transactions.period_id`. Det erstatter den kode-konvention der i dag lever spredt i `useSellerSalariesCached.ts` og `hours.ts` (logik 16).
- `pricing_rules` får eksplicit livscyklus: *kladde → aktiv → udfaset*. UNIQUE-constraint på `(product_id, priority, campaign_match_mode, campaign_set_hash, effective_from)` afskaffer den tilfældige tie-breaker (logik 1, "Ingen tie-breaker ved ens priority. Postgres row-order afgør.").
- `employee_identities` erstatter den løse trekant `employee_master_data ↔ agents ↔ sales.agent_email` med én kanonisk identitet per medarbejder og `employee_aliases` (mange-til-én) for dialer-strenge. FK fra `sales.identity_id` til `employee_identities.id`. Aliasses kan tilføjes; identiteter fryses ved fratræden (jf. dokument-til-gennemgang §6).

Default deny på alt RLS. Hver tabel skal have eksplicit policy, eller migrationen fejler i CI. Audit-trigger på alle rød-zone-tabeller registreres ved migration via en pg-funktion `enable_audit('table_name')` der attacher trigger og indsætter rækken i en `audited_tables` register-tabel.

**Lag 2 — Kerne-domænet.** Ren TypeScript i en intern pakke `@stork/core`, importeret identisk af edge functions og frontend. Indeholder:

- `pricing.match()` — den ene autoritative pricing-funktion. Erstatter dobbelt-implementation i `src/lib/calculations/pricingRuleMatching.ts` og `supabase/functions/_shared/pricing-service.ts`, der i 1.0 holdes 1:1 manuelt uden diff-test (logik 1).
- `salary.compute()` — løn-aggregation pr. medarbejder pr. periode.
- `identity.resolve()` — én resolver, ikke en 4-trins fallback spredt over hooks (logik 8: mapping → work_email → username → agent_email).
- `period.from(date)` og `period.status(periodId)` — periode-helpers.
- `attribution.team(saleId)` — ren funktion på allerede-hentet data; bevarer 1.0's korrekte `team_clients`-vej (logik 8).

Pakken er pure: ingen DB-adgang, ingen IO. Den tager input og producerer output. Det gør CI-tests trivielle og udelukker den drift-risiko der i dag findes mellem edge og frontend (logik 1's "frontend ↔ edge drift").

**Lag 3 — Gateway.** Ét bibliotek under `src/services/` (frontend) og `supabase/functions/_gateway/` (edge). Det er **det eneste sted** der må importere `@/integrations/supabase/client`. Eksempler:

- `salesService.recordSale(input)` — kalder den rigtige RPC, validerer permissions, returnerer typed resultat.
- `salaryService.getPeriodSalary(employeeId, periodId)` — bruger `salary.compute()` fra kerne-domænet med data hentet via service.
- `permissionService.has(key)` — eneste indgang til adgangskontrol.

Apps må kun importere fra `services/` og fra `@stork/core`. ESLint-regel forbyder import af `supabase/client` udenfor `services/`. Dette løser de 146 komponenter der i dag kalder Supabase direkte (CLAUDE.md §5; egen kontroltælling viser 101 hits alene i `src/components/` på `supabase.from`/`supabase.rpc`).

**Lag 4 — Apps (Mathias' "grene").** Hver app har eget mappe-træ, egne routes, egne komponenter, egne app-lokale hooks. Ingen kommunikation mellem apps undtagen via `services/` eller via dokumenterede events. Apps følger en standard skabelon (`src/apps/<navn>/{routes,components,hooks,types}`) men må afvige indenfor mappet. De kan ikke afvige udenfor — det er rammeregler, ikke smag.

Aktuelle apps fra dokument 1: salg, løn, dashboards, FM-booking, rekruttering, onboarding, AMO, GDPR-flows, e-conomic, gamification, kontrakter, pulse, code-of-conduct. Ny app (uddannelses-platform er nævnt som mulighed) er en ny mappe; den arver kerne, gateway og lag 1's kvalitet uden at genopfinde noget.

**Identitet × team × rolle bliver tre rene tabeller.** `employees` (personen) → `employee_team_memberships` (mange-til-mange) → `teams`. `team_clients` med UNIQUE(client_id) bevares fra 1.0; den virker (logik 9). Permissions bliver en separat dimension: `permissions` (key, label), `roles` (konfigurerbar via UI), `role_permissions` (M:M), `employee_roles`. Ingen sammenflettede roller som `fm_medarbejder_` (logik 14). FM-tilhør udtrykkes via team-medlemskab; rollen er bare `medarbejder`. Det rydder op i de 96,9% identiske `medarbejder` og `fm_medarbejder_` (logik 14) uden at miste FM-medarbejdernes specielle data-adgang — den kommer fra teamet, ikke rollen.

Superadmin er en separat tabel `system_superadmins` med database-trigger der RAISE'er ved DELETE hvis count ville falde under 2. Ingen anden hardkodet bypass. Eksisterende `if (roleKey === 'ejer') { const ownerPermissions = generateOwnerPermissions(); }` i `src/hooks/usePositionPermissions.ts:266-267` udgår fuldstændigt; permissions kommer fra DB via `permissionService.has(key)`. Det samme gør den parallelle hardkodede `job_title → role`-mapping i `src/hooks/useUnifiedPermissions.ts:123-134` (verificeret i koden).

**Livscyklus-dimensioner som første-klasses koncept.** Salgets livscyklus, lønperiodens livscyklus, identitetens livscyklus, pricing-reglens livscyklus og kandidatens livscyklus er fem uafhængige state machines, modelleret eksplicit i DB. Status-modellen fra dokument 1 §3.3 (sales = pending + annulleret + godkendt + afvist; annullering separat; lønperiode separat) er præcist hvad denne model implementerer: dimensionerne A og B er bare to state machines der refererer til samme `sale_id`.

**Integration-adaptere.** Hver kilde — Adversus, Enreach, e-conomic, Twilio, M365 — får én adapter under `supabase/functions/_adapters/<kilde>/`. Adapteren er en pure function fra rå payload til kanonisk DTO. Råpayload bevares i `integration_events` (immutable, allerede etableret som mønster i `adversus_events`, jf. logik 23). Når en ny dialer skal kobles på, skrives en ny adapter; intet andet ændres. Det er præcis hvad dokument 1's "API-feltkortlægning + Entity Resolution"-lag (DEL 2.2) skal være.

**Compliance er ikke et lag — det er en automatik der bindes på.** Hver persondata-tabel har en `retention_policy_id` som FK til en `retention_policies`-tabel der er konfigurerbar i UI. Et scheduled job traverserer politikkerne og kører anonymisering eller sletning gennem GDPR-edge-funktioner med audit i `gdpr_cleanup_log` (logik 27). AMO bevares som i dag — det er det mest disciplinerede modul (dokument 1 §1.4). EU AI Act dækkes af `ai_instruction_log` med en dekorator der pakker alle AI-touchpoints; gateway gør det automatisk så apps ikke kan glemme det (logik 28). Bogføringslovens 5-årsregel bliver en retention-politik på `economic_invoices` der nægter sletning før udløb.

**Hvor data lever.** Én database, én Supabase-instans, ingen multi-tenancy. Klienterne (Tryg, Eesy m.fl.) er klienter af Copenhagen Sales — ikke brugere af Stork. Multi-tenancy ville tilføje kompleksitet uden at løse et reelt problem. Skalering sker via Supabase compute + arkiverings-strategi (åbent spørgsmål i CLAUDE.md §7).

**UI-styrbarhed konkret.** Alt brugerdata bor i tabeller og redigeres gennem UI: pricing-værdier, kampagne-mappings, retention-politikker, roller, permissions, dashboards, klient-tildelinger, vagtplaner. Men forretningsregler (15→14, 12,5% feriepenge, pricing-matching-algoritmen, attribution-vejen) bor i kode i `@stork/core` og kan ikke ændres fra UI. Skellet er klart: hvis det er en *parameter*, lever det i DB; hvis det er en *regel*, lever det i kode.

## 2. Hvorfor netop denne model

**Vedligeholdelig af to partnere med AI.** Modellen reducerer den effektive overflade Mathias og Kasper skal forstå til fire faste navne (datalag, kerne-domæne, gateway, apps). En AI-prompt der siger "tilføj feature X til løn-app" kan håndteres uden at AI'en behøver scanne 290k linjer for at forstå hvilke filer der må røres. Mappestrukturen er forudsigelig; en ny medarbejder eller AI kan finde "hvor logikken sidder" uden 95+ memory-noter (CLAUDE.md §1). Den eneste viden der ikke kan udledes fra mappestrukturen er forretningsregler — og dem er der 15 af, samlet i biblen. Hot spots fra dokument 1 §1.5 (pricing, lønberegning, sales-attribution, permissions, cache) bliver til ét sted hver i kerne-domænet i stedet for 8-12 filer pr. spot.

**Skalerbar.** Lag 4 (apps) er pluggable. En uddannelses-app er en ny mappe; den arver lag 1-3. To nye klienter med forskellige salgsflows er to konfigurations-rækker i `client_campaigns` plus eventuelt en ny adapter — ikke en ny kodebase. 200+ ansatte rammer ikke arkitekturen; det rammer Supabase compute og query-performance. Disse kan løses uden at røre modellen (read-replicas, materialized views, partitionering på `pay_period_id`). Den eneste reelle skalerings-grænse i modellen er antallet af apps, men der er ingen øvre grænse fordi de er uafhængige.

**Compliance-sikker.** Retention-policy som FK på persondata-tabeller gør GDPR-sletning til en konfigurations-handling, ikke en ad-hoc-opgave. Audit-trigger automatisk på rød zone gør at *enhver* ændring i AMO, kontrakter, lønperioder, pricing fanges uden at udvikleren skal huske det. Bogføringslovens 5-årsregel er en politik, ikke en konvention. EU AI Act-loggen er en dekorator i gateway-laget; apps kan ikke omgå den. Den `gdpr_data_requests`/`security_incidents`-infrastruktur der allerede findes (CLAUDE.md §4 rød zone) bruges som-er.

**Håndhævelig over tid.** Det er kernen — det 1.0 ikke kunne. Modellen indeholder seks tekniske håndhævelses-mekanismer (sektion 3 nedenfor). Vigtigst: *du kan ikke skrive en komponent der kalder Supabase direkte uden at CI fejler*. Du kan ikke tilføje en pricing-regel uden tie-breaker. Du kan ikke skrive `if (role === 'ejer')` fordi der ikke er en `role`-streng at sammenligne med — du har en typed `permissionService.has()`-funktion. Den arkitektoniske intention er kodet ind i type-systemet, RLS, ESLint og CI — ikke i en bibel der skal læses og adlydes. Det adresserer den specifikke fejlmode i 1.0 hvor god intention smuldrede uden håndhævelse (dokument 1 §1.5: "Systemet har allerede forsøgt god arkitektur ... Den smuldrede fordi den ikke blev håndhævet i praksis").

## 3. Håndhævelses-mekanismer

Konkrete mekanismer der **tvinger** modellens regler, ikke opfordrer:

1. **Genererede typer fra DB-skemaet.** Supabase genererer allerede `Database`-typer; vi udvider med generators der laver `PermissionKey`, `RoleKey`, `PageKey`, `QueryKey` som union-typer fra tabel-rækker. Konsekvens: en ny permission tilføjet i DB bliver automatisk en valid string i frontend; en stavefejl er en compile-fejl, ikke en stille cache-miss (logik 26's kebab-case-rod). De 69 hardkodede rolle-referencer i 8 filer (logik 13) bliver compile-fejl næste gang nogen tilføjer en.

2. **ESLint custom rule: no-direct-supabase.** Forbyder import af `@/integrations/supabase/client` udenfor `src/services/`. CI fejler. Det adresserer de 146 direkte Supabase-kald (CLAUDE.md §5; verificeret 101+ hits i `src/components/`).

3. **CI fitness-funktioner.** Et script der tæller arkitektoniske overtrædelser og fejler hvis tallene stiger over baseline: antal `: any` (855 i dag, CLAUDE.md §5.10), antal `console.log` (182, dokument 1 bilag A), antal hardkodede rolle-keys (69 ifølge logik 13). Det forhindrer regression uden at kræve big-bang oprydning.

4. **RLS default deny + migration-gate.** En migration der opretter en tabel uden mindst én RLS-policy fejler i CI via et linter-trin der parser migrations-filer. Audit-trigger attaches automatisk via `enable_audit()`-funktion der kaldes i migrationen — der er en lint-regel der kræver det for tabeller der matcher rød-zone-mønstre.

5. **Pricing-konsistens-test.** En CI-test der kører den samme pricing-regel-matrix gennem `@stork/core` og ekstraherer den fra edge-runtime; de skal give samme resultat. Det erstatter den manuelle 1:1-vedligeholdelse mellem `pricingRuleMatching.ts` og `_shared/pricing-service.ts` (logik 1's kendte rod).

6. **Periode-låsning som DB-constraint.** Når `pay_periods.status = 'paid'`, nægter en RLS-policy UPDATE eller INSERT på `commission_transactions WHERE period_id = ?`. Princip 3 (lønperiode låses) håndhæves i database, ikke i hooks. Retroaktiv pricing-rematch på låst periode rammer en RAISE og afbrydes.

Hertil kommer to mekanismer der ikke er teknisk håndhævelse men strukturelle:

7. **Append-only zone-register.** En markdown-fil i repo der lister rød-zone-filer; en pre-commit-hook tjekker at PR'er der ændrer dem har "ZONE: red" i commit-message. Lille friktion, store huskelapper. Det er det eneste sociale element jeg ville tilføje, fordi der findes ændringer som AI ikke kan vurdere.

8. **App-isolation via folder-imports.** ESLint-regel: en app må ikke importere fra en anden app. Hvis `apps/loen` skal bruge noget fra `apps/salg`, skal det op i `services/` eller `@stork/core`. Det forhindrer den langsomme sammenfletning der har gjort 1.0 svær at refaktorere.

## 4. Risici og blinde pletter

**Migrations-vejen er ikke triviel.** Modellen kræver et `employee_identities`-flytning der berører hver `sales`-række via et nyt FK. På 100+ daglige brugere kan det ikke ske online uden en kort planlagt blokering. Dette er fase 3, men det er en risiko at modellen overhovedet er gennemførlig under drift.

**`@stork/core` som delt pakke mellem edge og frontend kræver bundling-arbejde.** Supabase Edge Functions kører Deno; frontend kører Vite/Node. En delt TypeScript-pakke skal kompileres til begge runtimes. Det er løsbart (esbuild, deno-compatible imports) men det er en operationel kompleksitet der ikke findes i 1.0. Hvis bundling fejler, falder vi tilbage til 1.0's manuelle 1:1-vedligeholdelse — det er ikke acceptabelt. Mod-foranstaltning: kerne-pakken skrives bevidst i en delmængde af TypeScript der er kompatibel med begge runtimes (ingen Node-specifikke imports, ingen dynamic imports).

**Default deny RLS er aggressivt.** Mange eksisterende edge functions kører med `verify_jwt = false` (Adversus-webhook eksempelvis, logik 23) og kalder med service role. Hvis vi tightener policies for hårdt, kan vi blokere webhook-flow der i dag virker. Dette skal omhyggeligt scopes — service role bør stadig kunne skrive, men auth-brugere skal kun kunne det de har permission til.

**Antal kerne-objekter med eksplicit livscyklus er en designvariabel jeg ikke har sat fast.** Jeg foreslår fem (sale, pay_period, pricing_rule, employee_identity, cancellation), men der kan være tre der gør samme arbejde, eller syv der tegner billedet bedre. Klient-livscyklus og produkt-livscyklus er muligvis kandidater (dokument-til-gennemgang §15 nævner dem). Mathias bør beslutte.

**Generering af typed permission-keys er afhængig af at permissions-tabellen er rigtig.** Hvis vi mister en migration eller får inkonsistent data mellem environments, ryger compile-fejl-garantien. Mod-foranstaltning: permissions-tabellen seedes via migrations, ikke via UI initialt — UI bruges kun til at koble dem til roller.

**Modellen forudsætter at AI-genereret kode kan respektere lag-grænser.** Mathias arbejder med Lovable som primær builder. Lovable er kendt for at gå "den korte vej" og kalde Supabase direkte fra komponenter — det er præcis hvordan 1.0 endte med 146 direkte kald. ESLint-reglen fanger det, men det skaber friktion. Mod-foranstaltning: prompt-skabelon i CLAUDE.md der eksplicit beder bygger-AI'en om at gå gennem service-laget. Hvis Lovable konsekvent bryder reglerne på trods, er modellen ikke gennemførlig med Lovable som hovedmotor.

**Et blindt punkt:** hvordan integration-adaptere håndterer skema-ændringer hos eksterne (Adversus tilføjer felt, Enreach ændrer struktur). Det er ikke et model-spørgsmål, men et drift-spørgsmål. Modellen siger bare "adapter er en pure function" — den siger ikke noget om versionering af adaptere over tid.

## 5. Hvad jeg ikke har taget stilling til

- **Antallet og afgrænsningen af apps.** Jeg har antaget Mathias' 16 grene fra dokumentet til gennemgang, men jeg har ikke vurderet om "Marketing" og "Rekruttering" reelt er to apps eller én, eller om "Gamification" hører hjemme som app eller som tværgående pakke.

- **Hvorvidt FM-booking fortsat skal være en separat app eller smelte sammen med Salg når FM-migrationen er færdig** (dokument 1 §1.5: FM er halv-migreret). Det afhænger af om Brand-dimensionen helt udfases.

- **Strategi for arkivering af gamle salg.** Skalerbarhed mod 200+ ansatte handler mere om data-volumen end kode-arkitektur. Jeg har ikke lavet en partitions-strategi.

- **Real-time vs. polling for cross-session updates.** Jeg har antaget at `mg-test-sync`-mønstret bevares (logik 26) men kun gjort cache-keys typed. Om det skalerer til 200+ samtidige brugere er en empirisk fremtidig vurdering.

- **Multi-superadmin-godkendelse for kritiske handlinger** (sletning af klienter, ændring af pricing-regler i produktion). Mathias har ikke ekspliciteret om superadmin-handlinger skal kræve to-mands-godkendelse for nogle operationer. Modellen tillader det men foreskriver det ikke.

- **Hvilken konkret state-machine-implementation vi bruger.** Jeg har skrevet "state machines" som datakonstruktion, ikke som teknologi. Postgres-trigger-baserede transitions er ét valg; en library som xstate er et andet. Det er fase 3.

- **Hvordan migration-kontinuitet sikres.** Jeg har ikke taget stilling til om ny model rulles ud big-bang eller en gren ad gangen. Det er fase 3, men det påvirker hvor lemfældig modellen kan være med "tving alt nyt gennem services" — i en migrations-fase findes både ny og gammel kode samtidig.

- **`product_campaign_overrides`'s skæbne.** Logik 1 + CLAUDE.md §7 markerer det som åben beslutning. Min model forudsætter at den enten migreres ind i `product_pricing_rules` eller bevares som eksplicit override-mekanisme der læses af pricing-motoren. Jeg har ikke valgt for Mathias.

## 6. Alternativer du fravalgte

**Modulær monolit med Domain-Driven Design og bounded contexts.** Det er reelt det jeg foreslår — DDD's "bounded contexts" matcher Mathias' grene. Jeg fravalgte at kalde det DDD eksplicit fordi navnet bringer en hel skole af ceremonier og artefakter (aggregates, ubiquitous language-workshops, domain events) der ikke betaler sig for to partnere + AI. Jeg har taget DDD's strukturelle indsigter (kerne-domæne, anti-corruption layer, eksplicitte grænser) uden at hænge dem op på navnet.

**Event sourcing for sales og lønperioder.** Tiltrækkende fordi audit-trail-spørgsmålet og status-modellen (dokument-til-gennemgang §5: "salget ved ikke noget om løn") løses gratis: alle events er fakta, projektioner er views. Annulleringer er et `CancellationOccurred`-event der ikke ændrer det oprindelige `SaleRecorded`-event. Jeg fravalgte fordi: (a) event-sourcing er notorisk svært at debugge og query, (b) eksisterende kode er tabel-baseret og en migration ville være enorm, (c) Mathias og Kasper skal kunne læse data direkte i Supabase Studio, hvilket er praktisk umuligt med rene event streams. En light-weight version (immutable hovedtabel + snapshot-projektioner) opnår 80% af gevinsten med 20% af kompleksiteten — og det er reelt det de allerede har for `commission_transactions`, `economic_invoices`, `pricing_rule_history` (logik 18). Jeg foreslår at udvide det mønster, ikke at omfavne fuld event-sourcing.

**Microservices med separate databases pr. domæne.** Hvert kerne-domæne (salg, løn, HR, FM-booking, compliance) som selvstændig service med egen Postgres. Tiltrækkende fordi det fjerner cross-pollution. Jeg fravalgte fordi: (a) lønberegning kræver i ét kald data fra fire domæner (salg, vagter, annulleringer, medarbejder) — det bliver enten distribueret transaktion eller eventual consistency, begge dele er en byrde for to partnere; (b) operational kompleksitet (5+ services × deploy + monitor + secrets) er fjendtlig overfor Mathias' setup; (c) Supabase er optimeret til én database, og den er det største operationelle aktiv i 1.0. Hellere én database med stærke moduler-grænser i kode.

**Backend-for-frontend med headless administration.** Adskil UI-laget helt fra forretningslogik via et BFF-API-lag. Jeg fravalgte fordi det dobbelt-implementerer noget Supabase allerede gør (RPC + RLS), og fordi kompleksitetsomkostningen er stor for to partnere uden at løse et reelt problem. Stork har ikke flere klient-UI'er; det har én.

## 7. Proces-rapport

**Rækkefølge.** Jeg pullede main, læste prompten, læste `dokument-1-forstaaelse.md` (det vigtigste fundament), `storks-logikker.md` (alle 28 logikker — jeg brugte mest tid på 1, 8, 13, 14, 16, 26 fordi det er hvor rod og åbne beslutninger er størst), `stork-logikker-til-gennemgang.md` (Mathias' tænkning), og verificerede et par citater direkte i koden — `src/hooks/usePositionPermissions.ts:266-267` (ejer-bypass) og `src/hooks/useUnifiedPermissions.ts:123-134` (parallel job_title→role-mapping). Jeg læste ikke `bibel.md`, `system-snapshot.md` eller `ui-snapshot.md` fra ende til anden; jeg slog op i CLAUDE.md (som jeg har som kontekst) og brugte den som indeks.

**Hvor kernen tippede.** Det centrale skifte var da jeg gennemgik logik 16 (lønperiode 15→14 hardkodet, ingen DB-låsning) sammenholdt med princip 3 (lønperiode låses ved udbetaling) og dokument 1 §3.3's status-model. Indsigten var: det 1.0 mangler er ikke "bedre lag" men **eksplicitte livscyklus-tilstande i data** — fordi det er præcis dér 1.0 falder fra hinanden (retroaktiv pricing rammer udbetalt løn, periode-konvention er kun social, status er implicit i hooks). Stamme/grene-billedet var rigtigt; det manglende var at give "stammen" eksplicit livscyklus-semantik. Det rammer også §5's logik om at lønnen er separat system der læser salgets sandhed — det fungerer kun hvis salgets sandhed har eksplicit tilstand.

**Iterationer.** Mit første udkast havde "stammen" som en abstrakt kerne-pakke. Jeg revurderede da jeg så Mathias' §10 i gennemgangen: hans 16 grene inkluderer "Database/API" og "Mapping" som grene, hvilket er en kategoriel fejl — de er horisontale lag, ikke domæner. Anden iteration skelnede skarpt mellem datalag (Postgres + RLS), kerne-domæne (delt TypeScript), gateway (services) og apps (grene). Tredje iteration tilføjede livscyklus-state-machines som første-klasses koncept, ikke bare en feature.

**Hvor jeg er mindst tilfreds.** Beskrivelsen af compliance er tyndere end den burde være. Jeg har sagt "retention-policy som FK på persondata-tabeller" og "audit-trigger automatisk", men hverken nævnt EU AI Act's konkrete krav til transparens overfor medarbejdere, eller hvordan vagt-overlap validering (åben beslutning §7) konkret skal sidde. Jeg er også usikker på om min "fitness function"-tilgang til at tælle overtrædelser holder; den er let at omgå ved at omdøbe filer eller introducere nye anti-mønstre der ikke er fanget af tællingen. Endelig har jeg ikke valideret at min foreslåede tabel-struktur for `employee_identities` faktisk kan rumme alle de 4 fallback-tilfælde i logik 8 — det skal valideres på faktisk data før modellen er sikker.
