# Dokument 1: Forståelse af Stork

**Version:** 1.0 · 23. april 2026
**Formål:** Beslutningsgrundlag for Stork 2.0. Dette dokument alene skal give læseren fuld forståelse af systemet — hvad det er, hvor det skal hen, og hvordan vi tænker det skal fungere.

**Samles af:** Mathias Dandanel Grubak (adm.dir.) og Kasper (partner/medejer), med input fra Claude.ai (strategi), Claude Code (teknisk analyse) og Lovable (bygger-AI).

**Læsning:** Hele dokumentet bør læses før beslutninger om 2.0 træffes.

---

# DEL 1: SYSTEMET I DAG

## 1.1 Hvad Stork er

Stork er Copenhagen Sales ApS' interne salgs- og lønsystem. Bygget på 5 måneder med AI-partnerskab (primært Lovable som bygger-AI, Claude Code til dyb analyse, Claude.ai til strategi).

**Stork præsenterer sig som ét system. Indefra er det syv-otte systemer der deler database og login:**

- Et CRM (klienter, kampagner, produkter, salg)
- Et lønsystem (provision, faste lønninger, diæter, oplæringsbonus, annulleringer, manuelle tillæg, feriepenge, ferieafregning)
- Et HR-system (medarbejdere, kontrakter, signaturer, fravær, ferie, onboarding, deaktivering)
- Et rekrutteringssystem (kandidater, ansøgninger, booking-flow, SMS/email-sekvenser, M365-kalender)
- Et FM-bookingsystem (lokationer, hoteller, biler, vagter, diæter, oplæringsbonus, leverandørrapporter)
- Et compliance-system (AMO, APV, kemi, møder, dokumenter, audit, GDPR, AI-governance)
- Et bogføringsbridge (e-conomic invoices, Revenue Match, Sales Validation)
- Et BI-/dashboard-lag (TV-boards, leaderboards, Powerdag, head-to-head, forecast, KPI-snapshots)
- Et telefoni-/kommunikationssystem (Twilio voice + SMS, M365 mail, agent presence, softphone)

**De er bygget i lag, ikke parallelt. CRM + løn er stammen. Alt andet er podet på over tid.** Det forklarer meget af det der ser inkonsistent ud.

### Systemet i tal

- ~290.000 linjer TypeScript/TSX
- 267 tabeller
- 120 RPC'er
- 109 edge functions
- 408 komponenter
- 111 hooks
- 662 migrations
- 3 testfiler (skrøbeligt)
- 25 moduler identificeret
- 160 routede sider + 17 skygge-sider
- 61 KPI-definitioner (56 aktive, 5 inaktive)
- 95+ memory-noter

**Navnet "Stork"** findes i koden (UI-tekster, compliance-sider, produktions-URL `stork.copenhagensales.dk`). Det er ikke kun internt — det er systemets faktiske navn.

## 1.2 Hvem bruger det

**100+ aktive brugere dagligt** fordelt på flere brugertyper:

- **TM-sælgere** — telemarketing, arbejder i Adversus/Enreach
- **FM-sælgere** — field marketing, arbejder på lokationer
- **Teamledere** — leder TM- eller FM-teams
- **Assisterende teamledere** — støtter teamledere
- **Rekruttering** — kandidatflow og onboarding
- **Stab/backoffice** — løn, kontrakter, drift
- **Ledelse/ejere** — strategisk overblik og administration

### Klienter

Stork leverer salgstjenester på vegne af:

- **Tryg** (forsikring)
- **Finansforbundet** (fagforening)
- **ASE** (a-kasse + forsikring)
- **Nuuday-brands** — hver brand er **egen klient** i systemet (YouSee, TDC Erhverv, Eesy m.fl.), **ikke koblet sammen som familie**

## 1.3 Systemets dele

### 25 moduler

Claude Code har ved statisk scanning identificeret disse moduler. De er grupperet efter funktion:

**Kerne-forretning:**
- Salg
- Løn & Provision
- Pricing
- Annulleringer

**Forretningsmoduler:**
- FM Booking (Vagt-flow) — 14 sider + 10 content-wrappers
- Gamification (League + Head-to-Head + Powerdag + Car Quiz + Extra Work)
- Rekruttering, Kandidater & Short Links — 12 sider
- Onboarding — 4 routede sider + 6 sub-views
- Kontrakter & E-signatur (SharePoint-synk via M365)
- E-conomic (Bogføring) — 8 sider
- Dialer Integrations (Adversus + Enreach)
- Stempelur & Tidsregistrering

**Infrastruktur:**
- Authentication & MFA
- Permissions
- Twilio Voice + SMS
- Intern kommunikation (Chat, Messages, SMS, Email, M365-kalender)
- Cron & Scheduled Jobs (deles af 5+ moduler)
- System-admin, Feature Flags & Developer Tools (MgTest, ExcelFieldMatcher, LoginLog)

**Compliance:**
- GDPR & Persondata
- AMO (Arbejdsmiljø)
- Code of Conduct
- Pulse Survey

**Dashboards:**
- Dashboards & TV-boards (13 dashboards + TV-links)

### Brugerflader

**160 routede sider** fordelt på:

- 11 offentlige (ingen login) — auth, kontrakt-signing, kandidat-booking, referrals
- 16 personlige (alle medarbejdere) — hjem, profil, vagtplan, mål, beskeder, gamification
- 12 salg & rapporter
- 14 dashboards (plus 4 TV-boards)
- 14 vagt-flow (FM)
- 4 shift planning
- 12 rekruttering
- 4 onboarding
- 11 AMO
- 14 GDPR/Compliance
- 8 e-conomic
- 3 løn
- 16 admin/system
- 3 Powerdag

**17 ikke-routede sider** — nogle er skygge-kode (kandidater til oprydning), andre er sub-tab-komponenter der bruges via dynamisk import.

### De 13 dashboards i systemet

- Dagsboard CPH Sales
- Fieldmarketing
- Eesy TM
- TDC Erhverv
- Relatel
- Relatel Produkter
- MG Test
- United
- Test Dashboard
- CS Top 20
- Salgsoversigt alle
- Superliga Live
- Powerdag

Hvert dashboard kan tilgås via TV-link (spejl af moder-dashboard).

## 1.4 Hvad virker godt

Det er vigtigt at huske systemets styrker — ikke kun udfordringer.

- **Pricing-motoren virker** — 76+ kampagner prises korrekt med komplekse regler
- **Multi-dialer-integration** (Adversus + Enreach) er robust
- **Lønberegningen leverer månedligt** til 100+ medarbejdere uden kritiske fejl
- **FM dual-path attribution** håndterer Top 20-leaderboard korrekt
- **KPI-caching** gør TV-skærme hurtige (calculate-kpi-incremental + snapshots)
- **e-conomic-afstemning** (Revenue Match) fanger månedlige uoverensstemmelser
- **AMO-compliance** er bygget og kører — mest skemadisciplinerede modul
- **GDPR-infrastruktur** er delvist bygget (gdpr-edge-functions, consent-logging)
- **Multi-tenant-logikken** via team_clients (UNIQUE på client_id) er stram på klient-ejerskab
- **Skabelonen er stærk** — næsten alle moduler følger samme mønster (tabel + edge function + hook + RPC)
- **UI'et dækker forretningslogikken** for pricing og mange andre områder

**Compliance-laget (AMO, GDPR, AI-governance) er det nyeste og mest skema-disciplinerede.** Det fungerer som reference for hvordan andre moduler kunne se ud hvis de blev bygget i dag.

## 1.5 Hvad virker skidt

### Overordnet diagnose (fra Lovable)

**"Skabelonen er stærk, udførelsen er ujævn."** Næsten alle moduler følger samme mønster — men hvor logikken sidder inden for mønstret varierer. Nogle lægger forretningsregler i RPC'en, andre i hooket, andre i en service-fil.

### Tre identiteter for én person — og koblingen er løs

En sælger findes som:
- `employee_master_data.id` (HR-identitet)
- `agents.id` pr. dialer-kilde (Adversus, Enreach — kan være flere rækker for samme person)
- `sales.agent_email` (attribution-strengen fra dialer-payload)

Koblingen sker i `employee_agent_mapping` — mange-til-mange, **ingen FK-constraint** sikrer integritet. Navne-resolveren har 4-trins fallback (mapping → work_email → username → agent_email).

**Konsekvens:** Samme person kan optræde som "Mathias D." i én rapport og "mathias@..." i en anden.

**Parallelt:** Hardkodet `job_title → role`-mapping i `useUnifiedPermissions.ts:124-134` kører samtidig med DB-drevet `position_id → system_role_key`. **Dobbelt sandhed.** Tredje lag: trigger der auto-sætter `position_id` baseret på `job_title`. **Cirkulær uden cykel.**

### FM er halvt-migreret fra selvstændigt system

FM startede som selvstændigt system og blev migreret ind i Stork. Migreringen er ikke færdig. Resultater:

- `fm_medarbejder_` som rolle (team blandet ind i rolle — **ikke bevidst**, skal ryddes op)
- Egen pricing-fil (`fmPricing.ts`)
- Eget bookingsystem
- Dual-path attribution (fallback-logik for FM-salg uden clean agent-attribution)
- FM-specifikke cancellation-regler (Eesy TM/FM med 8 telefon-felter)
- Brand-udfasning ikke færdig — brand lever stadig i FM-booking

### Håndhævelses-problem

Systemet har allerede forsøgt god arkitektur (fx permission-laget via `role_page_permissions`). Den smuldrede fordi den ikke blev håndhævet i praksis. Nu findes **flere konkurrerende kilder til rolle-information** (afhængig af tælle-metode 4-10 stk.).

- Hardkodet ejer-bypass 5 steder i `usePositionPermissions.ts`
- 69 hardkodede rolle-referencer i 8 filer
- "Stab" findes som job-title men ikke som system-rolle
- 10 roller i UI kollapses til 5 i RLS-policies (finkornet differentiering forsvinder)
- 6 roller har priority = 100 (ingen reel rangordning)

### Rod der skal gøres skarpere

Eksempler identificeret af Lovable:

- **product_campaign_overrides:** 76 aktive rækker. Redigeres i UI. Læses IKKE af pricing-motoren. Ingen har opdaget det.
- **Pricing-prioritet uden tie-breaker:** ORDER BY priority DESC uden sekundær sortering. Ved ens priority afgør Postgres' fysiske row-order udfaldet.
- **Relatel og Eesy har bevidst ingen `effective_from`** så historisk rematch ikke bryder gamle data. Stiltiende konvention, ikke håndhævet i skemaet.
- **Tre popup-systemer uden orchestration** (pulse-surveys, code-of-conduct, league-announcement)
- **RolePreviewContext** — ubrugt debug-feature der koster vedligeholdelse i 5+ steder
- **Frontend- og edge-pricing holdes 1:1 manuelt** — ingen automatisk diff-test fanger drift

### Hot spots — hvor kompleksitet samler sig

Fem områder hvor logikken hænger tungt sammen og berører 8-12 filer hver:

1. **Pricing-motoren** (product_pricing_rules + matchPricingRule + _shared/pricing-service + fmPricing + rematch-pricing-rules + MgTest + ProductCampaignOverrides + ProductMergeDialog + useKpiTest)
2. **Lønberegning** (useSellerSalariesCached + useAssistantHoursCalculation + useStaffHoursCalculation + useEffectiveHourlyRate + hours + vacation-pay + commission_transactions + salary_additions + cancellation_queue + daily_bonus_payouts + personnel_salaries + booking_diet + booking_startup_bonus)
3. **Sales-attribution** (8-10 lag fra dialer-payload til KPI)
4. **Permission-resolution** (kræver tjek af 4-5 filer for at svare på "har denne person adgang?")
5. **Cache-invalidation cross-session** (QUERY_KEYS_TO_INVALIDATE + mg-test-sync + manuelle invalidateQueries-kald i 100+ mutations)

### Forretningsregler hardkodet i helpers, ikke i DB

- Lønperiode 15.→14. (hardkodet i helpers, **ingen pay_periods-tabel**, **ingen period_locks-tabel**)
- Provisions-satser for ASE (400/1000 kr.)
- Oplæringsbonus = 750 kr. fast
- 12,5% feriepenge-tillæg
- Minimumsfrist for ferieanmodning = 35 dage
- Pricing-tie-breaker (implicit "den der kom først")

### Skygge-funktionalitet — ting der bruges men ikke er synlige

**Cron-jobs:** process-booking-flow (hver 5. min), check-compliance-reviews (ugentligt), calculate-kpi-incremental. Ikke synlige i UI — lever i pg_cron.

**Database-triggers der gør tunge ting:** enrich_fm_sale (BEFORE INSERT), create_fm_sale_items (AFTER INSERT), validate_sales_email (BEFORE INSERT), amo_audit_trigger_fn, remove_deactivated_employee_from_teams, auto-set position_id. **En udvikler der læser kun frontend-kode ville aldrig vide at insert i `sales` udløser 3-4 ting i DB.**

**Healers:** enrichment-healer (retter manglende data på sales efter indkomst), heal_fm_missing_sale_items (manuel reparation).

**Realtime broadcasts:** mg-test-sync-channel + flere. Ikke centralt registreret.

**Andet:** RolePreviewContext, SessionTimeoutProvider, LockOverlays, CompleteProfileBanner, 3 popup-systemer, Sidebar Menu Editor.

## 1.6 Hvad ved vi ikke

Åbne spørgsmål der kræver undersøgelse eller beslutning:

**Tekniske:**
- Forskel mellem `transactions` og `commission_transactions` (Mathias' bedste bud: løn vs. lokationer — skal verificeres)
- Hvad `LockOverlays` præcist bruges til i dag (sandsynligvis fra tidligere overbelastning)
- Om `employee_client_assignments` bruges til attribution eller kun adgang
- Præcis hvor i `personnel_salaries` rollover gemmes
- Hvorfor `sales_ownership` KPI er markeret inaktiv selvom den er autoritativ
- Forskellen mellem `consent_log` og `gdpr_consents`
- Hvor langt brand-udfasningen er gået i moduler ud over FM-booking
- Om trailing underscore i `fm_medarbejder_` var bevidst (det var **ikke**)

**Forretningsmæssige:**
- Hvorfor 6 roller har samme priority = 100
- Om alle 15 principper fra biblen faktisk håndhæves i koden
- Hvilke KPI'er skal dække pending/udbetalt/annulleret/afvist-modellen (er ikke bygget)
- Skal klienter være teknisk adskilte i 2.0 (multi-tenancy)?

**Fra Lovable som bygger:**
- Overlap mellem `churn_60_day` og `new_hire_churn_60d`
- Den præcise tabel-struktur for rollover
- Hvilke af de 15 principper der stadig håndhæves og hvilke der er glidet

---

# DEL 2: VISIONEN

## 2.1 Hvor skal Stork hen

Stork 2.0 er den næste version af systemet — en videreudvikling der løser de strukturelle udfordringer 1.0 er løbet ind i.

**Vision:** Stork 2.0 skal være et system hvor:

- **Daglig drift kan administreres i UI** uden kode-ændringer
- **Arkitekturen håndhæves** så den ikke smuldrer over tid
- **Nye grene (applikationer/moduler)** kan bygges hurtigt på samme fundament
- **Historik bevares altid** og data er sandhed
- **Superadmin-rettigheder** styres via UI med indbygget sikkerhed mod selvmål
- **Compliance (GDPR, EU AI Act, Bogføringsloven, Arbejdsmiljøloven)** er indbygget, ikke add-on
- **Fundament-logikker** (pricing, løn, attribution) ligger i kode så de ikke kan brydes fra UI
- **Udvidelse** (nye dialere, nye klient-systemer, nye data-kilder) kan ske uden at røre fundamentet

**Tidsramme:** Ikke forudbestemt. Sættes når omfanget er kendt.

## 2.2 Stork 2.0's tre dimensioner

### Dimension 1: Lag-arkitektur

Hvordan data, logik og UI skal adskilles. Problemet i 1.0: 146 komponenter kalder Supabase direkte (bryder princippet om service-lag). Ingen klar adskillelse mellem UI, beregning og data-adgang.

**I 2.0:** Klar lag-arkitektur med håndhævede grænser. Den præcise form (kasser, events, CQRS, hexagonal osv.) er **åben beslutning**.

### Dimension 2: Permissions (rolle × team)

To uafhængige dimensioner skal styre adgang:

- **Rolle** bestemmer hvilke **dele af systemet** en bruger må se (menu, sider, funktioner)
- **Team** bestemmer hvilken **data** inden for det der vises

**Hertil kommer:** Medarbejder er en tredje dimension. Tre uafhængige dimensioner — ikke én.

**I 1.0 er de sammenblandede.** Flere konkurrerende kilder, hardkodede bypasses, "fm_medarbejder" som konstruktion der blander team og rolle.

**I 2.0:** Rent adskilte. Rolle afgør system-adgang. Team afgør data-scope. Medarbejder er personen. Superadmin er undtagelsen.

### Dimension 3: API-feltkortlægning + GDPR + data-livscyklus

Adversus, Enreach, e-conomic, Twilio, M365 sender samme virkelighed (adresse, kunde, produkt) i forskellige formater.

**I 2.0:** Entity Resolution / Master Data Management-lag der:

- Normaliserer felter fra forskellige kilder (fx telefonnummer fra to dialere → én kolonne)
- Håndterer data-livscyklus (immutable vs. living)
- Overholder GDPR (persondata kan slettes selv om historik bevares)
- Kan udvides med nye kilder uden at bryde eksisterende

## 2.3 Stamme-og-grene-modellen

**Stork er en platform med fælles fundament (stamme) og selvstændige applikationer (grene).**

### Stammen (fælles fundament)

Fælles for alle applikationer. Skal være stærk, konsistent og veldefineret:

- Auth + superadmin-system
- Rettighedssystem (rolle + team)
- Data-adgang & RLS
- UI-komponenter og design-tokens
- Integration-lag (Adversus, Enreach, M365, Twilio, e-conomic)
- Cron & scheduled jobs
- GDPR-fundament
- Audit & compliance-infrastruktur

### Grenene (applikationer)

Selvstændige forretningsområder der vokser ud fra stammen. Aktuelle grene:

- Salg & rapportering
- Løn & provision
- Dashboards (+ TV-boards)
- Field Marketing (vagt-flow)
- Rekruttering
- Onboarding
- AMO
- GDPR-compliance
- E-conomic
- Gamification
- Kontrakter
- Pulse Survey
- Code of Conduct

**Fremtidige grene** kan være uddannelses-miljø eller andre forretningsinitiativer. Nye grene arver stammens kvalitet.

### Principper for stamme-og-grene

1. **Stammen er stærk. Grenene kan variere.** Stammen definerer rammer. Grene kan afvige lokalt (fx dashboards med eget rettighedssystem).
2. **Stamme-forbedringer gavner alle grene.** Investering i stammen har multiplikator-effekt.
3. **Nye grene er hurtige at bygge.** Når stammen er god, skal nye applikationer ikke genopfinde grundlaget.
4. **Første prioritet i 2.0 er stammen.** Grene arver stammens kvalitet. Rodet stamme = rodet grene.

---

# DEL 3: VORES TÆNKNING (LOGIKKERNE I BRED FORSTAND)

Dette er **vores principper og forretningstænkning** — ikke den mekaniske beskrivelse af koden. Den mekaniske del ligger i Lovables logik-rapport (bilag).

## 3.1 Principper

### UI-styrbarhed (præciseret)

**Alt daglig drift og data styres via UI:** medarbejdere, vagtplan, pricing-værdier, rettigheder, bookinger, klienter, kampagner osv.

**Men selve systemet kan ikke ændres via UI.** Fundamentale logikker, beregningsregler, datastrukturer og systemrammer bor i koden. Ellers bryder ændringer downstream.

**Skelnen:** Data og værdier = UI. System og beregninger = kode.

**Konsekvens:** Intet modul er færdigt før det kan styres i UI (for data-/værdi-delen). Administrations-interface er ikke add-on — det er en del af modulet.

### Superadmin-system

**Kun ét hardkodet: Systemet har altid mindst 2 superadmins med fuld adgang til alt.**

Regler:
- Superadmins administreres i `system_superadmins`-tabel
- Styres via UI (som alt andet)
- Systemet **forhindrer at antallet falder under 2** (database-constraint/RLS)
- Alle andre rettigheder er fuldt konfigurerbare i UI
- **Ingen hardkodede rolle-bypasses**

Udover fuld adgang kan superadmin også **låse dele af systemet** så andre rettigheds-indehavere ikke kan ændre dem. Det er kontrol over hvem der må ændre hvad — ikke kun adgang.

### Dashboards som selvstændigt modul

Dashboards er et selvstændigt modul i 2.0 med:

**Rettigheder:**
- Eget rettighedssystem — ikke bundet til rolle×team fra resten
- Kun én rettighed arves: *"må administrere indstillinger-siden"*
- Alt andet (hvilke dashboards, hvilke data, hvilke KPI'er) styres lokalt

**Data-adgang:**
- Lokale principper for data-adgang pr. dashboard
- Hvert dashboard definerer selv hvilke KPI'er og data det viser
- Ikke "alle data" — kurateret udsnit

**TV-link:**
- Når et dashboard oprettes, kan det tilgås via TV-link
- TV-link er et **spejl af moder-dashboardet**
- Ændringer i moder afspejles automatisk
- Ingen separat kopi, ingen drift

### Fundament i kode

**Fundamentale beregninger må ikke ændres fra UI.** KPI-definitioner, pricing-motor, attribution-logik, lønberegning — alt sammen i koden. UI kan **bruge** dem, men ikke **ændre** dem.

**Hvorfor:** Ændring af fundament fra UI bryder downstream. Det er dét der gik galt med det tidlige KPI Definitioner-modul (byggede UI-redigering af fundamentale logikker — skal omlægges).

## 3.2 Forretningsregler (15 principper fra biblen)

Disse er besluttede forretningsregler der guider al udvikling:

1. **Database = sandhed.** Alt andet er views af samme sandhed.
2. **Historik bevares altid.** Med strategi for arkivering og sletning over tid.
3. **Periode-låsning.** Lønperiode låses når udbetalt.
4. **Klient er dimensionen.** Brand udfases gradvist; FM-booking bruger den stadig.
5. **Provision registreres ved salgstidspunkt.** Ikke ved betaling. Motivation hos sælger vigtigere end timing-præcision mod klienternes CRM-systemer. Afstemning sker bagud via upload/match-system der matcher Stork-salg mod klienternes CRM-data.
6. **Lønunderskud ruller over.** Ingen negativ løn. Afskrives ved medarbejder-stop.
7. **Teamleder-DB beskyttes.** Uinddrivelige beløb fra stoppede medarbejdere må ikke tælle mod teamleder.
8. **Single source of truth, også i koden.** Samme forretningsregel må kun eksistere ét sted.
9. **Data-adgang går gennem service-lag.** Komponenter tilgår ikke databasen direkte (146 filer bryder det i dag).
10. **Ferie anmodes 5 uger før.** Kræver lederens godkendelse.
11. **Ved konflikt vinder biblen** over memory-noter. Ved konflikt mellem bibel og kode, vinder kode — men uenigheden rapporteres.
12. **Zone-tvivl er rød zone.** Det er billigere at spørge for meget end at lave en kritisk fejl.
13. **Historik bevares, sletning med plan.** GDPR-sletning følger eksplicit proces, ikke ad hoc.
14. **Konsolidering er ikke nok — oprydning er nødvendig.** Gammel kode slettes når ny virker, ikke når man får tid.
15. **Forståelse før handling.** Hvis opgaven er uklar: spørg hvorfor, gæt ikke.

## 3.3 Status-modellen (pending/udbetalt/annulleret/afvist)

Dette er en **kritisk model** der ikke tidligere har været klart formuleret i systemet. Den er etableret gennem dagens arbejde.

### Grundmodel

**Sales (alle registreringer) = pending + annulleret + godkendt + afvist**

Alt hvad sælgeren har tastet ind. Viser reel salgsaktivitet.

**Annulleringer er en separat begivenhed** — ikke "sales minus noget", men egen hændelse der trækkes fra provisionen senere.

**Løn-provisionsberegning:**
```
Løn-provision = Provision fra alle salg − Annulleringer
```

Sælger får provision ved registrering (princip 5). Hvis salget senere annulleres, trækkes det fra i den lønperiode hvor annulleringen lander.

### Udbetalings-status pr. lønperiode

Et salg har **to status-dimensioner**:

**Dimension A — Registrerings-status** (status på salget selv):
- Pending — endnu ikke afgjort
- Annulleret — kunde fortryder / salg falder efter godkendelse
- Godkendt — salget står fast
- Afvist — systemet/klient afviser salget som ugyldigt

**Dimension B — Udbetalings-status** (status pr. lønperiode):
- **Udbetalt** — provision fra salg i en **låst** lønperiode
- **Annulleret** — fradrag i nuværende periode
- **Pending** — i nuværende periode, endnu ikke låst
- **Afvist** — fradrag i nuværende periode

### Lønperioder som "fryse-punkt"

Når en lønperiode **låses**, fryses alt provision i den periode fast.

**Konsekvens:**
- Salg fra låst periode = "udbetalt provision" (fast, uændret)
- Hvis samme salg senere annulleres → fradrag i den nye aktuelle periode
- Oprindelig udbetaling i gammel periode bevares uændret

**Eksempel:**

**Periode A (låses 14. marts):**
- Salg registreres 3. marts, pending
- Periode A låses → salg er nu "udbetalt provision" (+500 kr)
- Sælger har fået 500 kr udbetalt — det står fast

**Periode B (åben):**
- Samme salg annulleres 2. april
- Annulleringen lander i periode B som fradrag (−500 kr)
- Periode B's rapport: "Annulleret provision"
- Periode A's rapport: "Udbetalt provision" står stadig uændret

### Stammen som sandhed

**Det reelle salg er det salg der blev annulleret.** Uanset hvor smart vi modellerer lagene ovenpå — ét fakta ændres aldrig: det salg der blev registreret, og det der skete med det.

**Stammen (Supabase + data):**
- Salg eksisterer som fakta
- Annulleringer eksisterer som fakta
- Historik bevares
- Ingen fake

**Grenene (beregning + rapportering):**
- Kan beregne forskellige perspektiver
- Lønperiode-perspektiv (hvad blev udbetalt hvornår)
- Netto-perspektiv (hvad har sælger tjent samlet)
- Klient-perspektiv (hvilke salg er reelle)
- Alle bruger samme stamme

**Grenene må ikke ændre stammen.** De må kun læse fra den og beregne views ovenpå.

## 3.4 Rettigheds-tænkningen (tre uafhængige dimensioner)

### Medarbejder × Team × Rolle

Tre uafhængige dimensioner — ikke én:

- **Medarbejder** — en person
- **Team** — tilhørsforhold (Fieldmarketing, TM-team, osv.)
- **Rolle** — systemadgang (medarbejder, fm, teamleder, osv.)

**Rettigheder afgøres af rollen** — ikke af en sammensmeltet "fm_medarbejder"-konstruktion.

### Team-attribution (fra systemets egen Logikker-side)

Dokumenteret som `sales_ownership` i systemets `/logikker`-side. Autoritativ for alle dashboards og rapporter:

**Team-attribution går KUN via klient** (`team_clients`), **ikke via sælgers team** (`team_members`).

- `team_clients` har UNIQUE(client_id) — én klient kan kun ejes af ét team
- Sælgerens eget team er **irrelevant** for team-ejerskab
- Eksempel: Thorbjørn fra Relatel sælger for eesy TM → tælles under eesy TM teamet (ikke Relatel)

**Logikken:**
1. Leder er en rolle
2. Leder "ejer" et team
3. Teamet har klienter (via team_clients)
4. Klienterne afgør økonomien i teamet
5. Lederens løn beregnes ud fra teamets DB

### Employee × Client assignments

Der findes også `employee_client_assignments` som muliggør individuel tildeling. **Tanken:** adgangs-tildeling, ikke attribution-omlægning. Teamets DB påvirkes ikke af at en medarbejder fra andet team får adgang til en klient.

Men præcisionen af dette er ikke verificeret. **USIKKER.**

## 3.5 Andre nøgle-logikker (punkter)

### Pricing og provision

- TM og FM bruger samme pricing-system i UI men to forskellige kode-implementationer
- TM-salg kommer fra dialer (Adversus/Enreach); FM-salg fra manuel registrering (lokation driver klient + kampagne)
- Pricing styres via `product_pricing_rules` med priority-system og kampagne-matching
- Historik på pricing bevares (gyldighedsperioder, versioner)
- Provision kan kobles til enhver tilgængelig data — dialer-data + berigelses-data i systemet (fx ASE straksbetaling)

### Cancellation

- `cancellation_queue` er matching-resultatet (immutable, rød zone)
- `deduction_date` styrer hvilken lønperiode der rammes (ikke salgsdato)
- Match-flow: upload → matching → pending → godkendelse → approved → fradrag i løn
- Eesy TM/FM har separat matching-vej (8 telefon-felter, opp_group)
- Negativ løn afskrives ved medarbejder-stop (princip 6)
- Teamleder-DB beskyttes mod stoppede sælgeres gæld (princip 7)

### Integration

- **Adversus + Enreach** (dialere) — forskellige auth-modeller, forskellige rate-limit-strategier
- **e-conomic** — bogføring, månedlig afstemning via Revenue Match + Sales Validation
- **Twilio** — softphone voice + SMS
- **M365 Graph** — email, kalender, SharePoint (opdelt mellem Kontrakter og Intern kommunikation)
- **Custom password-reset** — egen token-baseret flow, ikke Supabase standard

### Data-livscyklus

- **Immutable tabeller** (princip 2): e-conomic invoices (ALDRIG UPDATE/DELETE), AMO audit-log, commission_transactions, og flere
- **Living data** (kan opdateres): medarbejderdata (med GDPR-regler), vagtplaner, kandidater
- **Sletningsregler** (GDPR): gdpr-edge functions, cleanup-jobs, cleanup-inactive-employees

### KPI-struktur

61 KPI-definitioner i systemet (56 aktive):

- **16 Salgs-KPI'er** (sales_count, total_commission, total_revenue, annullering, liga_provision, osv.)
- **16 Timer-KPI'er** (salgstimer, sygetimer, ferietimer, forsinkede dage, osv.)
- **4 Opkalds-KPI'er** (alle inaktive)
- **8 Folk/medarbejder-KPI'er** (churn_60_day, active_employees, avg_tenure)
- **17 "Andet"** (achievements, UI-konfigurationer — flere er fejlplaceret som KPI'er)

**Hul:** `annullering`-KPI'en har pladsholder men ingen definition. Ingen KPI'er for "pending" eller "godkendt" som status.

### Tidsenheder

- `sale_datetime` (timestamptz) = primær tidsstempel
- Lønperiode 15.→14. **findes ingen steder som data** — hardkodet i helpers
- Uge = `booking.week_number + year`
- Måned = `client_monthly_goals.year_month` (string `YYYY-MM` — ingen DB-validering)
- **Ingen `period_locks`-tabel** — låsning er kode-konvention

### Cache og cross-session

- `QUERY_KEYS_TO_INVALIDATE` + `mg-test-sync`-broadcast for cross-session cache-invalidation
- Manuel registrering — glemmes det, opstår bugs når to brugere arbejder samtidig
- Query keys er strenge i kebab-case (stavefejl giver stille cache-miss)

### Audit og compliance

- AMO-audit er bredest (audit-trigger på alle amo_-tabeller)
- Contract-access-log for kontrakter
- Sensitive_data_access_log for CPR, bank, adresser
- Login_events + failed_login_attempts
- AI_instruction_log for EU AI Act
- Integration_logs + integration_debug_log

---

# DEL 4: UFRAVIGELIGE KRAV

Disse krav **skal** enhver arkitektur eller løsning opfylde. Her kompromitteres ikke.

## 4.1 GDPR og persondata

**Persondata skal kunne slettes.** Brugere eller medarbejdere kan kræve deres persondata slettet. Systemet skal kunne honorere forespørgsler inden for lovpligtige tidsrammer.

**Samtykke skal kunne dokumenteres.** For al behandling af persondata skal der være sporbart samtykke eller anden lovhjemmel.

**Adgang til sensitive data skal logges.** Hvem har set CPR, bank-oplysninger, kontrakter, adresser skal kunne spores efterfølgende.

## 4.2 Compliance

**Bogføringsloven:** Bogføringsdata bevares i minimum 5 år. E-conomic invoices må ikke slettes før denne periode er udløbet.

**EU AI Act:** Intern AI-governance skal dokumenteres. Use cases, ansvarlige roller, instruktioner til AI-systemer skal logges.

**Arbejdsmiljøloven (AMO):** AMO-dokumentation skal bevares med audit-trail. Ændringer skal kunne spores tilbage til hvem og hvornår.

## 4.3 Datasikkerhed

**Fejlagtigt data skal kunne rettes.** Uanset om data er i immutable tabeller eller event-sourced — hvis data er objektivt forkert, skal det kunne rettes via bevidst proces.

**Ingen utilsigtet data-tab.** Data må ikke forsvinde uden en bevidst beslutning og sporbart grundlag. Gælder også ved migrations og refactoring.

**Backup og gendannelse.** Systemet skal kunne gendannes fra backup i tilfælde af kritiske fejl.

## 4.4 Audit og sporbarhed

**Kritiske handlinger skal logges.** Ændringer i rettigheder, sletning af data, økonomiske transaktioner skal have audit-trail.

**Superadmin-handlinger er sporede.** Selv superadmins handlinger skal logges — de er ikke over systemet.

**System-ændringer (migrations) skal dokumenteres.** Hvem ændrede hvad i databasestrukturen og hvornår.

---

# DEL 5: BILAG (REFERENCER)

Dette er referencer til materiale der underbygger Dokument 1. Bilagene er ikke kopieret ind — de henvises der til som separate filer.

## Bilag A: Baseline-rapport

**Fil:** `docs/ai-handoff/baseline-cleanup-2026-04-22.md`

525 linjer tællings-baseret tech debt dokumenteret:
- 182 efterladte `console.log`
- 855 forekomster af `: any`
- 263 direkte Supabase-kald (bryder princip 9)
- 140 hardkodede rolle-referencer (20 filer)
- V2-filer identificeret (kun `PermissionEditorV2.tsx`)
- Feature flags (1 aktivt)

**Status:** Untracked i git. Skal committes før brug på andre miljøer.

## Bilag B: Claude Codes modul-inventar

**Fil:** `docs/system-as-is/module-inventory.md`

158 linjer, 25 moduler identificeret ved statisk scanning.

Overraskelser fra Claude Code:
- Cron & Scheduled Jobs som selvstændigt infrastruktur-lag (deles af 5+ moduler)
- Gamification samler League + Head-to-Head + Powerdag + Car Quiz + Extra Work
- Rekruttering, Kandidater & Short Links — cross-cutting
- M365 Graph fragmenteret (SharePoint→Kontrakter, kalender→Intern kommunikation)
- System-admin bred (MgTest, ExcelFieldMatcher, LoginLog)

## Bilag C: Frontend-sider-oversigt

**Fil:** `frontend-sider-oversigt.md`

Genereret 23. april 2026. 160 routede sider + 17 ikke-routede fordelt på 16 kategorier.

Sidstnævnte inkluderer reelle skygge-sider (`Teams.tsx`, `SalarySchemes.tsx`, `AmoPlaceholder.tsx`) og sub-tab-komponenter der bruges dynamisk.

## Bilag D: Lovables bygger-rapport

**Fil:** `lovable-bygger-rapport.md` (fra 23. april)

Bygger-perspektiv på Stork:
- Det første billede — 7-8 systemer der deler database og login
- 3 identiteter for én person
- Mønstre der gentager sig (6 mønstre identificeret)
- 12 skygge-funktionaliteter
- Hot spots (5 områder)
- Stille ting — ting der virker som få forstår
- 9 åbne spørgsmål fra Lovable selv

## Bilag E: Lovables logik-rapport

**Fil:** `storks-logikker.md`

1379 linjer, 28 logikker dokumenteret med:
- Navn, slug, kategori, status (OK/USIKKER/ROD)
- Beskrivelse, beregningsformel, SQL-query, datakilder, vigtige noter, eksempelværdi

Fordelt på 7 faser:
1. Kerne-økonomi (7)
2. Attribution & tilhørsforhold (5)
3. Permission & rolle (3)
4. Tid & låsning (3)
5. Klient-specifikke (4)
6. Integration (3)
7. Cross-cutting (3)

Plus tillæg: logikker ikke dokumenteret (med begrundelse), markante ROD-noter samlet (13 punkter), USIKRE punkter (10 der kræver verifikation).

**Note:** Vores status-model (pending/udbetalt/annulleret/afvist + lønperiode-låsning + stammen som sandhed) er mere præcis end Lovables beskrivelse af commission_calculation, seller_salary og cancellation_deduction. Denne model skal anvendes fremfor Lovables mekaniske beskrivelser hvor de er i konflikt.

## Bilag F: KPI Definitioner — inventar

**Fil:** `kpi-definitioner-inventar.md`

61 KPI'er i `kpi_definitions`-tabellen:
- Salg 16 · Timer 16 · Opkald 4 · Folk 8 · Andet 17
- Aktive: 56 · Inaktive: 5

**Vigtige huller identificeret:**
- `annullering` har pladsholder uden definition
- Ingen KPI'er for "pending" eller "godkendt" som status
- `sales_ownership` er inaktiv selvom den er autoritativ
- "Andet"-kategorien indeholder flere UI-konfigurationer og achievements der fejlagtigt er tagget som KPI'er

## Bilag G: Beslutninger og principper

**Fil:** `beslutninger-og-principper.md`

Notater fra forståelses-arbejdet 23. april 2026. Indeholder de fire principper (UI-styrbarhed, superadmin, dashboards, stamme-og-grene) med fuld kontekst og eksempler.

## Bilag H: Observationer (Claude og Mathias)

**Fil:** `observationer-claude-mathias.md`

Levende dokument med mønstre i samarbejdet. Ikke direkte relevant for Stork 2.0, men del af det samlede arbejde.

---

# AFSLUTNING

Dette dokument er beslutningsgrundlaget. Når Dokument 2 (visionen for 2.0) og Dokument 3 (planen for at komme dertil) udarbejdes, **starter læsningen her.**

**Vokser efterhånden:**
- Nye åbne spørgsmål tilføjes under 1.6
- Nye forretningsregler tilføjes til 3.2
- Nye skygge-funktionaliteter tilføjes til 1.5
- Nye krav tilføjes til DEL 4

**Ved konflikt:** Dette dokument plus de fire principper og de 15 forretningsregler vinder over alle bilag. Bilagene er referencer, ikke sandhed.

---

*Version 1.0 · 23. april 2026 · Samlet af Mathias med AI-partnerskab.*
