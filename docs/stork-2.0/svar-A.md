Jeg har læst prompten og de fire dokumenter. Snapshot-filerne (`system-snapshot.md`, `ui-snapshot.md`, `cross-reference.md`) og seneste `CLAUDE.md` mangler — jeg kan svare grundigt uden dem fordi `dokument-1-forstaaelse.md` og `storks-logikker.md` indeholder problemkatalog med fil/linje-præcision og 28 navngivne logikker. Jeg flagger i sektion 5 hvor de manglende filer begrænser min konkrethed.

Her er svaret.

---

# Stork 2.0 — anbefalet model

## 1. Anbefalet model

Modellen kan ikke navngives ved en standard arkitektur-skabelon. Det nærmeste den kommer er "én Postgres + disciplinerede domæne-grænser + forretningslogik som RPC'er + lint/RLS/CI-håndhævelse". For kortheds skyld kalder jeg den **håndhævet domæne-monolit**. Navnet er sekundært. Det primære er disciplinerne.

**Fundamentet: Stork 1.0's problem er ikke arkitektur-valg. Det er manglende håndhævelse.** Princip 9 ("data-adgang via service-lag") er korrekt — 146 komponenter ignorerer det (`dokument-1-forstaaelse.md` 1.5 + 2.2). Princip 8 ("single source of truth, også i kode") er korrekt — pricing eksisterer to steder og holdes 1:1 manuelt (`storks-logikker.md` logik 1, "Frontend ↔ edge drift"). Princip 1 ("databasen er sandhed") er korrekt — men forretningsregler bor i helpers og 95+ memory-noter (`dokument-1-forstaaelse.md` 1.5, "forretningsregler hardkodet i helpers"). Princip 11 ("ingen hardkodede rolle-keys") er korrekt — 69 forekomster i 8 filer (`stork-status-til-ny-chat.md` §5). 2.0 må gøre principperne til mekanismer, ikke beskrivelser.

**Lag 1 — datalaget.** Én Postgres. Ét schema. Versionerede migrations. Schema er strengt: alle FK-er findes (i 1.0 har vi tre identiteter for én person uden FK-integritet — `dokument-1-forstaaelse.md` 1.5, logik 1 i `storks-logikker.md`). RLS er adgangskontrol; den bruges ikke til forretningsfiltrering. Triggers begrænses til integritet (FK-cascading, check-constraints, simple defaults). Forretningslogik der i 1.0 lever i triggers — `enrich_fm_sale`, `create_fm_sale_items`, `validate_sales_email`, `auto_set_position_id`, `amo_audit_trigger_fn` — flyttes til navngivne RPC'er kaldt eksplicit fra service-laget eller pipeline-jobs. Audit-triggers og validation-triggers består.

**Lag 2 — domæne-laget.** Forretningslogik bor som RPC'er i Postgres, ikke i TypeScript. Pricing (logik 1+2), provisionsberegning (logik 3), lønberegning (logik 4-6), annulleringsbehandling (logik 7), attribution (logik 8-11), permission-resolution (logik 13), pay-periode-låsning (logik 16) — alt sammen RPC'er. En RPC findes ét sted. Det er det der løser drift-problemet i logik 1, hvor pricing-motoren findes både i `src/lib/calculations/pricingRuleMatching.ts` og `supabase/functions/_shared/pricing-service.ts`. Når der kun er ét sted, kan der ikke driftes. Tie-breaker for pricing-prioritet bliver eksplicit `ORDER BY priority DESC, created_at ASC` i RPC'et i stedet for Postgres' fysiske row-order (logik 1, punkt 5).

**Lag 3 — domæne-grænser.** Stork organiseres som en lille række domæner i `src/lib/domain/<navn>/`. Foreløbig opdeling: identitet, organisation, klient, salg, løn, vagt-flow (FM), rekruttering, kommunikation, dashboards, compliance, integration. Hvert domæne ejer sit data eksklusivt. Andre domæner kan kun læse via det eksponerede `index.ts` — aldrig direkte ind i interne filer. Det gør "stamme + grene"-modellen til kode i stedet for ide. Stammen = de fælles domæner (identitet, organisation, integration, compliance). Grenene = de forretningsspecifikke (salg, løn, FM, rekruttering, dashboards). En ny gren (uddannelses-platform) er en ny mappe der genbruger stammens RPC'er.

**Lag 4 — service-laget.** Hvert domæne har én TypeScript-modulgrænse: `src/lib/domain/<navn>/index.ts`. Komponenter må kun importere derfra. ESLint-regel forbyder direkte import af supabase-klient fra `src/components/` og `src/pages/`. I ét slag fjernes de 146 komponenter der i dag bryder princip 9.

**Lag 5 — UI.** UI viser data og styrer konfigurations-værdier. UI beregner ikke. UI skriver ikke direkte til business-tabeller — kun via mutationer der kalder RPC'er. RLS forbyder direkte INSERT/UPDATE på status-følsomme kolonner som `sales.status`; ændringer går gennem `transition_sale_status(...)` RPC'et der validerer overgange.

**Lag 6 — integration.** Hvert eksternt system har én adapter. Adapteren har ét ansvar: konvertere ekstern payload til intern canonical form. Adapteren kan ikke skrive direkte til business-tabeller — den emitterer events eller skriver til staging-tabeller som det relevante domæne konsumerer. Det skaber et tydeligt punkt hvor felt-kortlægning lever (Dimension 3 i `dokument-1-forstaaelse.md` 2.2). Telefonnummer fra Adversus' `Telefon1` og Enreach's `contact_number` normaliseres til `customer_phone` i adapteren. Identitet på tværs løses via `person_external_identities` (én person med agent-id i Adversus + agent-id i Enreach + email i M365 + employee_id i HR — alle peger på samme person via `persons.id`). Det fjerner 4-trins navne-fallback og dobbelt sandhed mellem `useUnifiedPermissions.ts:124-134` og DB-drevet `position_id → system_role_key` (logik 13).

**Lag 7 — compliance som tværsnit.** GDPR, audit, retention, EU AI Act, bogføring og arbejdsmiljø er ikke et modul — det er tværsnit. Audit-trigger på alle persondata-tabeller (eksisterer delvist i 1.0). Retention-jobs som cron pr. data-type, konfigurerbar i UI med audit. AI-instruction-log på alle AI-handlinger (eksisterer i 1.0 som `ai_instruction_log`, logik 28). `economic_invoices` og `commission_transactions` immutable (logik 18, bogføringsloven). AMO som eget domæne med egen audit (eksisterer). Det centrale: en compliance-erklæring pr. domæne — har du persondata? har du AI-handlinger? har du bogføringspligtige data? — og en CI-gate der afviser nye domæner uden de nødvendige mekanismer. I 1.0 er compliance bygget *ovenpå* moduler. I 2.0 bygges det *ind* fra dag ét.

**Lag 8 — forretnings-konstanter.** `business_constants`-tabel med audit. Lønperiode-grænser (15/14), feriepenge-procent (12,5), oplæringsbonus (750 kr.), ferieanmodnings-frist (35 dage), ASE-satser (400/1000 kr.) — alle her i stedet for hardkodet i helpers (`dokument-1-forstaaelse.md` 1.5). RPC'er slår dem op via lookup. Skelnen mellem konstant og system-logik: ASE-satsen er en konstant. ASE-straksudbetalingens *regel* (hvis straks-flag → 1000, ellers 400) er logik. Konstanten i tabel; reglen i RPC. Den skelnen er præcis hvor det tidlige KPI Definitioner-modul gik galt — UI-redigering af fundamentale logikker (`dokument-1-forstaaelse.md` 3.1). Det må ikke gentages.

**Status-modellen** (`dokument-1-forstaaelse.md` 3.3) implementeres direkte: `sales.status` ∈ {pending, godkendt, annulleret, afvist} håndhævet via RPC. Annullering er separat tabel (`cancellation_queue`, eksisterende). Lønperiode er ny tabel `pay_periods` med eksplicit `locked_at` — DB-trigger forhindrer mutationer på `commission_transactions`, `salary_additions`, `cancellation_queue` for låst periode. Annulleringer på låst periode flyttes automatisk til næste åbne periode via `deduction_date` (logik 7).

**Dashboards-grenen** har eget rettighedssystem (besluttet princip 3) men genbruger stammens audit, RLS-fundament og RPC'er. TV-link er view ovenpå moder-dashboard, ikke kopi. Det er en kontrolleret undtagelse, ikke en autonom enklave.

## 2. Hvorfor netop denne model

**Vedligeholdelig af to partnere med AI.** AI fungerer godt når grænser er tydelige. Hver domæne-mappe har sin egen `CLAUDE.md` der beskriver: hvad domænet ejer, hvilke RPC'er det eksponerer, hvad andre domæner må og ikke må. Lovable læser den før ændring. Lint-regler fanger overtrædelser før menneske ser PR. Type-systemet (TypeScript-enum genereret fra `system_role_definitions`) fanger forkert rolle-brug. Det giver en disciplin uden at kræve menneskelig review af hvert PR. I 1.0 har Lovable bygget hvad der virker; den retter ikke arkitektonisk drift fordi intet siger "stop". I 2.0 fejler builden, når Lovable prøver det.

**Skalerbar.** Skalerings-problemet ved 200+ ansatte er ikke hardware (Postgres holder mange flere). Det er kompleksitet pr. nyt forretningsområde. En ny gren (uddannelses-platform) er en ny mappe i `src/lib/domain/uddannelse/` med egne tabeller og RPC'er der genbruger stammens identitet, permissions, audit og integration. Den behøver ikke genopfinde noget. Det er præcis hvad princip 3 i stamme-grene-modellen lover ("nye grene er hurtige at bygge"). Hvis to nye klienter krævede helt forskellige salgsflows, ville modellen håndtere det via klient-specifikke kampagne-mappings og pricing-regler i stammen — uden at duplikere salgs-domænet.

**Compliance-sikker.** GDPR: persondata-tabeller har retention-jobs obligatorisk. Audit-trigger på alle persondata-tabeller. EU AI Act: alle AI-byggere (Lovable, Claude Code, Codex) skriver til `ai_instruction_log` via en standard webhook før commit. Bogføringsloven: `economic_invoices`, `commission_transactions`, `pricing_rule_history` er immutable (eksisterer i 1.0 — logik 18 og 28). Arbejdsmiljølov: AMO-modul med `amo_audit_trigger_fn()` på alle amo-tabeller (eksisterer). Det centrale er at compliance-CI-gate'en kræver nye domæner erklærer compliance-status, så vi ikke kan bygge en ny gren der "glemmer" GDPR.

**Håndhævelig over tid.** Det er det der smuldrede i 1.0. Konvention der ikke håndhæves smuldrer. Sektion 3 detaljerer mekanismerne. Det centrale: hver overtrædelse af modellen fejler builden. Lovable, Codex og Claude Code kan ikke smutte uden om — ikke ved at tilføje endnu en helper, ikke ved at importere supabase direkte, ikke ved at duplikere pricing-logik, ikke ved at tilføje en hardkodet rolle-key. Hvis byggeren prøver at gentage en 1.0-fejl, fejler builden.

## 3. Håndhævelses-mekanismer

Det her er kernen. Hvad **tvinger** compliance.

a. **ESLint-regel — direkte supabase-import udenfor service-lag.** `no-restricted-imports` på `src/components/` og `src/pages/`. Bygget i CI. Fjerner de 146 komponenter der bryder princip 9 — i ét slag og varigt.

b. **Type-genererede enums.** `npm run codegen` genererer TypeScript-enum fra `system_role_definitions`-tabellen. `if (role === 'ejer')` fejler `tsc` hvis 'ejer' ikke er i enummen. Hardkodede ejer-bypasses (`usePositionPermissions.ts:266` + 4 andre steder, logik 13) bliver umulige.

c. **RLS på status-felter.** `sales.status` har RLS-regel: UPDATE forbudt undtagen via `transition_sale_status(...)`-RPC'et. RPC'et validerer overgang og logger. UI kan ikke skrive status direkte. Status-modellen (3.3) er nu håndhævet, ikke bare beskrevet.

d. **DB-trigger på låst lønperiode.** Når `pay_periods.locked_at IS NOT NULL`: trigger på `commission_transactions`, `salary_additions`, `cancellation_queue` afviser INSERT/UPDATE/DELETE. Princip 3 ("lønperiode låses") går fra konvention til DB-håndhævet realitet.

e. **RPC-only beregninger.** Pricing-motoren er én funktion: `calculate_pricing(product_id, campaign_id, sale_date)`. Frontend kalder; udregner ikke. Drift mellem frontend (`pricingRuleMatching.ts`) og edge (`_shared/pricing-service.ts`) bliver umulig fordi der kun findes ét sted.

f. **Mappe-grænser.** ESLint-regel forbyder import af `src/lib/domain/<andet>/internal/*`. Kun `index.ts` er public. Domæne-grænser bliver kode, ikke ide.

g. **Snapshot-pligt.** GitHub Actions kører `npm run snapshot:generate` efter migrations. PR der ændrer skema men ikke opdaterer `docs/system-snapshot.md` afvises. Det fælles grundlag i biblen ("origin/main er kilden, snapshot-filer er fælles teknisk reference") håndhæves.

h. **Test-pligt for kritiske RPC'er.** Pricing, lønberegning, attribution, permission-resolution har obligatoriske tests. PR der ændrer disse uden at opdatere tests fejler. 1.0 har 3 testfiler — det er skrøbeligt. 2.0 har ikke 100% dækning, men kritiske RPC'er er låst af tests.

i. **Domæne-CLAUDE.md.** Hver domæne-mappe har egen `CLAUDE.md`. AI-byggeren læser den før ændring. PR der refererer ændringer udenfor erklæret scope flagges automatisk.

j. **Forretnings-konstant audit.** Trigger på `business_constants` logger automatisk hvem, hvornår, gammel værdi, ny værdi.

k. **AI-handlings-logging.** Alle AI-byggere skriver til `ai_instruction_log` før commit. EU AI Act dækket strukturelt, ikke som efterrationalisering.

l. **Superadmin-mindstegrænse.** `system_superadmins`-trigger forhindrer DELETE hvis count ≤ 2. Princip 2 fra 4-principper-listen håndhævet i DB.

m. **Cross-session sync.** Standardiseret realtime-broadcast-pattern. Hver mutation der ændrer fælles state emitterer event på navngivet kanal. I 1.0 er det ad hoc (`mg-test-sync-channel` + flere, ikke centralt registreret — `dokument-1-forstaaelse.md` 1.5).

## 4. Risici og blinde pletter

**Postgres-funktioner som primært logik-sted skaber ny kompleksitet.** Tests for PL/pgSQL er sværere end tests for TypeScript. AI-byggerne har mindre erfaring med PL/pgSQL. Hvis pricing-RPC'et bliver svært at teste, kan vi være værre stillet end 1.0 hvor logikken i det mindste er dobbelt-implementeret. Mitigation: pgTAP eller lignende test-framework, men det er en investering.

**AI-byggerne kan finde omveje rundt om lint.** Eksempel: Lovable kopierer kode mellem komponenter i stedet for at importere fra service-lag. Lint fanger ikke kopi der ikke importerer noget. Mitigation: jscpd eller sonarcloud i CI for kode-duplikation. Ikke perfekt.

**Domæne-grænserne kræver vi finder de rigtige.** Min liste er foreløbig. Hvis salgsvalidering placeres forkert (egen domæne? del af salg?), skaber vi nye hot spots. Domæne-design er en åben beslutning der bør tage uger med Mathias og Kasper, ikke timer med mig.

**Dashboards-modulets undtagelse er en svaghed.** Princip 3 siger eget rettighedssystem. Hvis dashboards-modulet får for meget autonomi, smuldrer det igen. Modellen forudsætter at dashboards stadig genbruger stammens audit + RLS-fundament — men det er en disciplin der nemt kan glide ved iteration.

**Forretnings-konstanter vs forretnings-regler grænsen er fluffy.** Hvis nogen kalder en regel en konstant, glider logik tilbage i tabel-styring fra UI. Det er præcis det der gik galt med "KPI Definitioner-modulet" i 1.0. Mitigation: review-disciplin når nye konstanter foreslås. Stadig en svaghed.

**Migration fra 1.0 er ikke valideret.** Modellen er fase 2; migration er fase 3. Hvis migrationsstien viser sig umulig (kan vi flytte alle 146 direkte supabase-kald uden at bryde drift?), må modellen tilpasses. Jeg har ikke verificeret stien.

**Postgres som single point of failure forstærkes.** Når mere logik bor i DB, er DB nede = alt nede. Backup + restore-strategi er kritisk. Supabase tilbyder dette, men det skal verificeres mod RTO/RPO-krav for løn-systemet (lønperiode-låsning skal kunne genskabes præcist).

**Min forståelse af 1.0 er begrænset til projekt-knowledge-filerne.** Snapshot-filerne (`system-snapshot.md`, `ui-snapshot.md`, `cross-reference.md`) ville give præcise RPC/edge-function-numre. Hvis snapshot afslører noget jeg ikke har set, kan modellen mangle dækning på et område.

## 5. Hvad du ikke har taget stilling til

- **Migration-strategi.** Eksplicit fase 3.
- **Tidsramme og ressourcer.** Eksplicit fase 3.
- **Konkret database-skema for 2.0.** For tidligt.
- **Liste af alle RPC'er.** For tidligt.
- **De 6 priority=100-roller skal differentieres** (åben i `stork-logikker-til-gennemgang.md` §9). Modellen forudsætter det sker, men ikke hvordan.
- **Konsolidering af medarbejder + fm_medarbejder_** (96,9% identiske, åben i §9). Modellen forudsætter konsolidering.
- **`product_campaign_overrides` skæbne** (76 aktive rækker, læses ikke af pricing-motoren — `CLAUDE.md` §7, logik 22). Slet-eller-behold er Mathias' beslutning.
- **Multi-tenancy for klienter** (åben i `dokument-1-forstaaelse.md` 1.6). Modellen kan understøtte begge veje uden grundlæggende ændring.
- **Realtime-broadcast-strategi for 200+ brugere.** Supabase Realtime kan håndtere det, men cross-session invalidation pattern skal designes konkret.
- **Superadmin-låsning: præcis hvad må de låse?** Princippet er klart, teknisk hvilke felter er ikke specificeret.
- **Auth-strategi for AI-handlinger.** Hvordan signeres en AI-handling? Hvem har ansvar? Åben.
- **Backup/restore-RTO/RPO** for løn-systemet — kritisk for compliance, ikke specificeret.
- **Snapshot-filer** (`system-snapshot.md`, `ui-snapshot.md`, `cross-reference.md`) var ikke tilgængelige. Modellen er begrundet med materialet jeg har, men konkrete fil/linje-citater er begrænsede til hvad der dukker op i project knowledge.

## 6. Alternativer fravalgt

**Alternativ A — Microservices.** Hvert af de 7-8 systemer (CRM, løn, HR, rekruttering, FM-booking, salgsvalidering, compliance, dashboards) bliver en egen service med egen database. For: tydelige grænser, uafhængig deployment, klar skalering. Imod: 2 partnere kan ikke vedligeholde 8 services. Operationel kompleksitet (deployment, observability, inter-service auth, distribuerede transaktioner) overstiger gevinsten massivt. Skalerings-problemet eksisterer ikke ved 200+ brugere. Cross-service forretningslogik (et salg påvirker provision i lønsystem) bliver enten dobbeltskrevet eller tungt orkestreret. Microservice-grænser ville løse 1.0's tværgående koblings-problem ved at gøre koblingerne dyrere, ikke renere.

**Alternativ B — Modulær monolit som industri-skabelon.** Hvert modul er en NPM-pakke (`@stork/sales`, `@stork/payroll`, `@stork/identity`). For: kendt mønster i node-økosystemet. Imod: "modulær monolit" siger intet om håndhævelse. Hvis Lovable kan importere `@stork/sales/internals` fra `@stork/identity`, har vi den samme situation som 1.0. Mønstret løser kun problemet hvis det også indeholder håndhævelse — og når man tilføjer håndhævelse, er det reelt det jeg har foreslået, bare med ekstra ceremoni omkring NPM-pakker. Vi er to partnere; ekstra pakke-styring er gæld uden gevinst.

**Alternativ C — Event sourcing + CQRS.** Alle ændringer = events i append-only log; views beregnes fra events. For: perfekt audit, perfekt time-travel, perfekt replay. Imod: kompleksitet for at løse problem vi ikke har. Stork har ikke brug for "afspille en sælgers salg fra et tidspunkt og se alternative virkeligheder". Vi har brug for "se hvad blev udbetalt 14. marts og hvorfor" — det løses med immutable `commission_transactions` + audit-log. Event sourcing løser samme problem 5x dyrere. AI-byggerne har lille erfaring med event sourcing — det øger risikoen for ad hoc afvigelser fra mønstret.

**Alternativ D — Hexagonal/Ports-and-adapters.** Forretningskerne i centrum, omverden via porte og adaptere. For: ren testbarhed, klar grænse mellem domæne og infrastruktur. Imod: ceremonien (interface for alt, dependency-injection-frameworks, mappers mellem domain-objects og DB-rows) er overkill for vores skala. Vigtigere: Stork er datatungt, ikke logik-tungt. 80% af systemet er CRUD ovenpå en kompleks datamodel. Hexagonal optimerer for forretnings-logik isoleret fra infrastruktur — vi har det modsatte problem (data-modellen ÉR kompleksiteten).

## 7. Proces-rapport

Læsning rækkefølge: vedhæftet prompt → `bibel-v3_1.md` → `dokument-1-forstaaelse.md` (mest tid her, særligt DEL 1's problem-katalog og DEL 3's principper + status-model) → `storks-logikker.md` (slog op specifikke logikker undervejs — særligt 1, 7, 13, 18, 22, 28) → `stork-logikker-til-gennemgang.md` (krydsreferencet mod 28-listen).

Iterationer:

Første gennemløb: jeg overvejede "modulær monolit" som default. Indenfor 30 sekunder spottede jeg det som skabelon-svar og udfordrede mig selv: hvad er det reelt der løser Storks problem? Hvad fanger navnet ikke? Svaret: håndhævelse. Modulær monolit siger intet om håndhævelse. Stork 1.0 er allerede en modulær monolit i ide; den smuldrede fordi ide ikke håndhæves.

Anden iteration: skulle logikken ligge i TypeScript-service-lag eller i Postgres-RPC'er? Argumentet for TypeScript: AI-byggerne er bedre til det. Argumentet for Postgres: én sandhed, ingen frontend/edge-drift, tættere på data. Drift-problemet i logik 1 (pricing holdes 1:1 manuelt mellem `pricingRuleMatching.ts` og `_shared/pricing-service.ts`) tippede mig mod Postgres. Jeg accepterer at det er sværere at teste.

Tredje iteration: compliance som modul vs. tværsnit. Modul-modellen er enklere at navngive. Tværsnit-modellen tvinger nye domæner til at have audit/retention/access-log fra dag ét. Tværsnit vandt fordi 1.0-problemet er at compliance er bygget *ovenpå* moduler i stedet for *ind* fra start.

Hvor kernen tippede: sætningen i `dokument-1-forstaaelse.md` 3.1 — "Det er dét der gik galt med det tidlige KPI Definitioner-modul (byggede UI-redigering af fundamentale logikker — skal omlægges)." Det viste mig at 1.0 har erfaringen med konsekvensen af at lade UI styre fundament. Princip 4 ("fundament i kode") er svaret på den lektion. Det forankrede lag-arkitekturen for mig: hvad er fundament (kode), hvad er konfiguration (tabel), hvad er UI (visning).

Mindst tilfreds med:

Sektion 1's lag-opdeling kan virke som konventionelt arkitektur-svar selvom jeg har tilstræbt det modsatte. Risiko for at læseren ser "lag-arkitektur" og overser "håndhævet disciplin". Jeg har forsøgt at kompensere ved at gøre sektion 3 så konkret som muligt om mekanismerne — men afsnittet om mekanismerne kunne stå tidligere, måske som sektion 1's kerne i stedet for at komme efter.

Min liste af domæner i sektion 1 er foreløbig og blev ikke gennem-testet mod alle 28 logikker. Salgsvaliderings placering (egen domæne vs. del af salg vs. del af integration) er den jeg er mindst sikker på.

Tværsnits-compliance er for skitseret. Mekanismen for hvordan en ny domæne erklærer compliance-status og automatisk får audit/retention er kun antydet — ikke designet til en grad hvor en bygger kunne implementere den.
