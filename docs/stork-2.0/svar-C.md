### 1. Anbefalet model

Min anbefaling er: **en kontraktstyret stamme-og-grene-model med livscyklusregistre i stammen**.

Stamme-og-grene er rigtigt tænkt, men den skal gøres hårdere end en organisatorisk metafor. I 1.0 findes der allerede mønstre, men de er ikke håndhævet: den genererede cross-reference viser nu **274 filer** med direkte Supabase-kald udenfor hooks (`docs/cross-reference.md:2937-2941`), mens `CLAUDE.md` beskriver princippet om, at komponenter aldrig må kalde Supabase direkte (`CLAUDE.md:113`). Derfor skal 2.0 ikke bare have "en stamme"; den skal have **kontrakter**, som grenene ikke kan gå udenom.

Stammen skal eje seks ting:

1. **Identitet og adgang**
2. **Kernefakta og livscyklusser**
3. **Beregningernes autoritative kode**
4. **Integration og feltkortlægning**
5. **Compliance, audit og retention**
6. **Service-lag og UI-kontrakter**

Grenene skal være applikationer: Salg, Løn, Field Marketing, Rekruttering, Onboarding, Dashboards, e-conomic/økonomi, AMO/GDPR/compliance, Gamification, Kontrakter og kommunikation. De må variere i UI og lokale workflows, men de må ikke eje sandheden om identitet, pricing, attribution, perioder, permissions eller compliance.

Data bør leve i **én fysisk Supabase/Postgres-database**, ikke i flere databaser. Stork har for meget delt virkelighed til at splitte data fysisk uden tung koordination: `sales` bruges af 53 steder (`docs/cross-reference.md:1469-1522`), `employee_agent_mapping` af 29 steder (`docs/cross-reference.md:727-756`), og `team_clients` af 25 steder (`docs/cross-reference.md:1647-1672`). Flere databaser ville flytte problemet fra kode til synkronisering. Til gengæld bør databasen opdeles konceptuelt i ejerskaber: stamme-tabeller, gren-tabeller og immutable ledgers. Ikke nødvendigvis separate schemas som fase-2-beslutning, men et ejerskab der kan håndhæves.

Identitet skal være en stammefunktion. I dag findes personen som `employee_master_data`, `agents` og `sales.agent_email`; `sales.agent_email` er en fritekstkolonne i `sales` (`docs/system-snapshot.md:349315-349332`), `agents` har egne email/dialer-id'er (`docs/system-snapshot.md:427-447`), og `employee_agent_mapping` binder dem sammen (`docs/system-snapshot.md:7368-7388`). Logik 8 beskriver den nuværende attribution som `sales.agent_email → agents.email → employee_agent_mapping → employee_master_data` og team via klient, ikke sælgers team (`docs/stork-2.0/storks-logikker.md:473-499`). I 2.0 bør personen være ét master-objekt, med eksterne identiteter som tilføjelser over tid: auth-id, work email, private email, Adversus-agent, Enreach-agent, Twilio/M365-identitet. Salg må gerne bevare rå `agent_email`, men stammen skal gemme den resolverede medarbejderrelation og resolver-version, så rapporter ikke skifter navn afhængigt af fallback.

Permissions skal modelleres som tre uafhængige dimensioner: **medarbejder × rolle × datascopes**. Rolle bestemmer systemadgang. Team/klient bestemmer dataadgang. Medarbejder bestemmer "egen data". I 1.0 er det blandet: `employee_master_data` har både `job_title` og `position_id` (`docs/system-snapshot.md:7956-7992`), `useUnifiedPermissions` bruger først `position_id`, men falder derefter tilbage til hardkodet `job_title → role` (`docs/ui-snapshot.md:28845-28882`), og `usePositionPermissions` har hardkodet ejer-bypass (`docs/ui-snapshot.md:20665-20687`). Logik 13 beskriver samme dobbelte sandhed og 69 hardkodede rolle-referencer (`docs/stork-2.0/storks-logikker.md:689-719`). I 2.0 må `job_title` ikke give rettigheder. En rolle er en rettighedsprofil, en jobtitel er HR-data, og et team er datascoping.

Superadmin skal være en stammefunktion, ikke en rollevariant. Der skal være en `system_superadmins`-sandhed med mindst to aktive superadmins, DB-håndhævet. Superadmin kan tilsidesætte adgang, men handlinger skal audites. Det erstatter `if roleKey === 'ejer'`-bypass, som i dag betyder at en navneændring eller rolleomlægning kan knække fuld adgang.

Livscyklusser skal også være stammefunktioner. 1.0 har data, men ikke altid livscyklus som data. `sales` har `validation_status`, `status`, `source`, `enrichment_status` og rå payload (`docs/system-snapshot.md:349326-349338`), men salgets model er først blevet præciseret i dokument 1: pending, godkendt, afvist, annullering som separat dimension, og lønperiode som separat fra salget. I 2.0 bør stammen eje livscyklusser for salg, annullering, lønperiode, identitet, pricing og klient/produkt. Salg fødes som rå hændelse, normaliseres, beriges, valideres og kan senere rammes af annullering. Annullering ændrer økonomisk konsekvens, ikke at salget fandt sted. Lønperioden læser salg og annulleringer og fryser et snapshot ved lås.

Lønperiode skal være data, ikke helper-konvention. Logik 16 siger at 15.→14. er defineret i kode, uden `pay_periods` eller `period_locks`, og at retroaktiv rematch kan ændre udbetalt løn (`docs/stork-2.0/storks-logikker.md:820-855`). Derfor skal stammen have periodeobjekter, låsestatus og immutable snapshots. `kpi_period_snapshots` viser allerede snapshot-tænkning med `period_start`, `period_end`, `scope_type` og `value` (`docs/system-snapshot.md:345540-345586`); løn bør have samme princip, bare hårdere.

Pricing skal være stammeberegning med UI-styrede værdier. `product_pricing_rules` er den reelle pricingtabel (`docs/system-snapshot.md:347919-347960`), mens `product_campaign_overrides` findes som aktiv tabel med egne priser (`docs/system-snapshot.md:347692-347724`). Cross-reference viser at overrides kun bruges af MgTest/ProductMerge UI (`docs/cross-reference.md:1326-1329`), mens `product_pricing_rules` bruges bredere inkl. `fmPricing.ts` og `rematch-pricing-rules` (`docs/cross-reference.md:1344-1359`). Logik 1 siger direkte, at overrides ikke læses af pricing-motoren, og at frontend/edge-pricing holdes 1:1 manuelt (`docs/stork-2.0/storks-logikker.md:113-116`). I 2.0 må pricing-værdier redigeres i UI, men motorens prioritet, tie-breaker, gyldighed og rematch-regler skal være kode- og databasehåndhævede. Ingen tabel må kunne se "styrbar" ud uden at være læst af motoren.

Integrationer skal være adaptere ind i stammen, ikke mini-systemer. Adversus og Enreach leverer salg; e-conomic leverer bogførings- og afstemningsdata; M365 leverer mail, kalender og SharePoint; Twilio leverer voice/SMS. Hver integration skal have rå event-log, normaliseret feltkort, idempotency, retry/rate-limit-regler og audit. Men business-beslutninger som attribution, pricing, valideringsstatus og lønpåvirkning må ligge i stammen. Det passer med logik 23-25: Adversus går webhook → validation → `sales` → enrichment → `sale_items`; Enreach har rate-limit-header og attribution fallback; e-conomic har sync/webhook/ZIP og Revenue Match (`docs/stork-2.0/storks-logikker.md:1094-1211`).

Compliance skal ikke være en gren ved siden af systemet; compliance skal være en stamme-egenskab, som også har egne UI-grene. I dag findes AMO-audit-log med `action`, `table_name`, `record_id`, `old_values`, `new_values` (`docs/system-snapshot.md:923-951`), GDPR-cleanup-log med `action`, `records_affected`, `details`, `triggered_by` (`docs/system-snapshot.md:9359-9384`), og AI-instruction-log til AI-governance (`docs/system-snapshot.md:569-598`). Logik 28 siger dog også, at der mangler rolle-audit-trail for `system_role_definitions` og `role_page_permissions` (`docs/stork-2.0/storks-logikker.md:1298-1330`). 2.0 skal derfor have data-klassifikation, retention, audit og reveal-logs som standard for alle stamme- og gren-tabeller.

UI skal være styringspanel, ikke autoritet. UI må oprette medarbejdere, ændre priser, give dashboard-adgang, starte rematch, låse perioder og administrere mappings. Men UI må kun gøre det via service-lagets kommandoer. En komponent må ikke kunne skrive direkte til `sales`, `sale_items`, `product_pricing_rules`, `role_page_permissions` eller compliance-tabeller. Det er den konkrete modgift mod 1.0's smuldring.

### 2. Hvorfor netop denne model

**Vedligeholdelig af to partnere med AI**

Modellen reducerer antallet af steder, Mathias og Kasper skal forstå for at ændre systemet. I dag skal permission-resolution læses på tværs af `employee_master_data`, `job_positions`, `system_role_definitions`, `role_page_permissions`, `system_roles`, hooks og hardkodet fallback. I 2.0 er spørgsmålet "har bruger X adgang?" besvaret af én permission-kontrakt: rolle giver feature-adgang, scope giver dataadgang, superadmin er separat og audited.

For AI er modellen også mere vedligeholdelig, fordi den giver klare filer og kontrakter at inspicere. AI klarer sig dårligt når regler er spredt som konventioner, memory-noter og parallelle fallbacks. Den klarer sig bedre når der er én pricingmotor, én identity-resolver, ét periode-register, én permission-kontrakt og én liste over tilladte service-adgange. Det er ikke en tung enterprise-model; det er færre veje til sandheden.

**Skalerbar**

Stork skal kunne vokse til 200+ ansatte, flere klienter og nye applikationer. Den vigtigste skalerbarhed her er ikke "kan databasen tage flere rækker", men "kan nye flows bygges uden at ændre fundamentet". Med denne model kan et nyt klientflow kobles på via integration/feltkortlægning, klient/kampagne/produkt, pricing-regler og salgs-livscyklus. Det kræver ikke nye identitetsregler, nye permission-bypasses eller en separat lønlogik.

Et nyt forretningsområde, fx uddannelsesmiljø, bliver en gren. Den arver identitet, permissions, audit, notification, retention og UI-kontrakter. Den skal kun definere egne data og workflows. Dashboards kan vokse separat, fordi de får eget lokalt rettighedslag som besluttet, men stadig læser kuraterede datakontrakter fra stammen og TV-linket er spejl, ikke kopi.

**Compliance-sikker**

Compliance bliver sikrere, fordi stamme-data klassificeres fra starten: immutable økonomi/audit, living employee/candidate data, rå integrationspayloads, sensitive fields, slettelige eller anonymiserbare data. GDPR-sletning bliver ikke et script, nogen husker; det bliver en livscyklus med retention-politik, audit og eksplicit bevaring af lovpligtige beviser. Bogføringsdata og økonomiske transaktioner bevares som immutable ledgers. EU AI Act får AI-use-cases, instruktioner og ansvarlige roller som auditable data. AMO fortsætter den stærke trigger/audit-disciplin, men den løftes op som generelt mønster.

**Håndhævelig over tid**

1.0 smuldrede, fordi reglerne kunne omgås. Denne model gør omgåelse sværere på flere niveauer: RLS og constraints i databasen, service-lag som eneste adgangsvej, lint-regler mod direkte Supabase-kald, test-gates på pricing/permissions/lønperiode, immutable triggers på historik, og runtime-monitors for invariants. Det afgørende er, at strukturen ikke kun beskrives i dokumentation. Den fejler build, blokerer mutationer eller skriver audit, når nogen går udenom.

### 3. Håndhævelses-mekanismer

Første mekanisme er **databasehåndhævelse**. Alle stamme-relationer skal have FK eller en bevidst undtagelse dokumenteret i skemaet. Identiteter må ikke hænge løst: dialer-identiteter skal pege på medarbejder/person, og salg skal bevare både rå ekstern identitet og resolved intern identitet. Permissions skal have constraints på rolle, scope og superadmin. `system_superadmins` skal forhindre færre end to aktive superadmins. `role_page_permissions` og rolledefinitioner skal have audit-trigger; logik 28 peger på, at det mangler i dag.

Anden mekanisme er **RLS som datascoping, ikke som rolle-erstatning**. RLS skal beregne adgang ud fra auth-bruger → medarbejder → rolle/scope/team/client. Den må ikke collapse 10 UI-roller til 5 skjulte DB-roller sådan som logik 14 beskriver (`docs/stork-2.0/storks-logikker.md:733-758`). Hvis to roller skal have samme dataadgang, skal det være eksplicit i permission-matricen, ikke en usynlig enum-mapping.

Tredje mekanisme er **immutability ved historik**. `commission_transactions`, `economic_invoices`, `amo_audit_log`, `gdpr_cleanup_log`, `kpi_period_snapshots`, pricing history og period snapshots skal kun kunne korrigeres via nye rækker med reference, ikke via stille UPDATE. Det følger logik 18 og 27: sletning/anonymisering sker via GDPR-flow, og bevismateriale bevares (`docs/stork-2.0/storks-logikker.md:1259-1285`). For fejlagtige data skal der være en korrektionstype, ikke fri redigering.

Fjerde mekanisme er **service-lag som importgrænse**. Frontend må kun tale med stamme og grene via hooks/services. Der bør være en CI-regel der fejler ved nye `supabase.from()` eller `supabase.rpc()` udenfor godkendte mapper. Cross-reference må gerne vise eksisterende gæld, men nye brud skal blokere. Det er den konkrete måde at undgå, at tallet 274 bliver 350.

Femte mekanisme er **ét beregningsbibliotek pr. fundamentlogik**. Pricing, attribution, KPI-definitioner og lønberegning må ikke eksistere som parallel frontend- og edge-implementation uden diff-test. Hvis edge og frontend begge skal bruge samme regel, skal de enten importere samme kilde eller være dækket af en kontrakttest, der kører samme cases mod begge. Pricing skal have deterministisk sortering: priority plus eksplicit tie-breaker plus constraint mod utilsigtede duplikater.

Sjette mekanisme er **livscyklus-tests og invariant-monitors**. Systemet skal løbende kunne svare på: findes der salg uden resolved medarbejder? Findes der pricing-regler med samme prioritet uden tie-breaker? Findes der låste lønperioder med ændrede underliggende beløb? Findes der rolleændringer uden audit? Findes der dashboard-TV-links uden moder-dashboard? Findes der GDPR-data uden retention-policy? De checks skal være synlige i drift, ikke kun testkode.

Syvende mekanisme er **central query-key og realtime-kontrakt**. Logik 26 viser, at cache-invalidation i dag bygger på manuelle string keys (`docs/stork-2.0/storks-logikker.md:1222-1248`), og UI-snapshot viser listen i `useMgTestRealtimeSync` (`docs/ui-snapshot.md:19335-19368`). 2.0 bør have typed query keys og en registry hvor mutationer deklarerer hvilke datakontrakter de invaliderer. Stavefejl i cache keys skal være typefejl, ikke produktionsfejl.

Ottende mekanisme er **admin-UI med guardrails**. Når UI styrer data og værdier, skal kritiske handlinger kræve preview, konsekvensvisning og audit-reason: ændring af pricing, låsning af lønperiode, superadmin-ændring, GDPR-sletning, permission-ændring, integration-rematch. UI skal vise hvad der sker, men service-laget bestemmer om det må ske.

### 4. Risici og blinde pletter

Den største risiko er, at stammen bliver for stor. Hvis alt kaldes "stamme", ender Stork 2.0 som en ny monolit med pænere navne. Stammen skal kun eje det, der skal være sandt på tværs: identitet, adgang, livscyklus, integration contracts, beregninger, audit og retention. Grenenes lokale workflow skal ikke centraliseres for centraliseringens skyld.

En anden risiko er, at én database bliver ved med at føles som "alle deler alt". Jeg anbefaler én fysisk database, fordi forretningen er tæt koblet, men den kræver hårde ejerskaber. Uden ejerskab, RLS, service-lag og audit bliver én database bare 1.0 igen.

Tredje risiko er, at livscyklusregistre bliver for tunge. Hvis hvert lille modul tvinges ind i en stor state-machine, bliver systemet langsomt at bygge. Derfor skal livscykluskravet gælde stammeobjekter: salg, annullering, lønperiode, identitet, pricing, klient/produkt, compliance-sager. Mindre grendata kan være enklere.

Fjerde risiko er dashboard-undtagelsen. Dashboards skal have eget rettighedssystem, men undtagelser har det med at brede sig. Den skal afgrænses: dashboard-rettigheder styrer dashboard-adgang og visning, ikke global dataadgang.

Femte risiko er, at "UI-styrbarhed" og "fundament i kode" bliver misforstået. Pricing-værdier kan styres i UI; pricing-motorens regler kan ikke. KPI'er kan vælges og placeres i UI; KPI-definitioner må ikke omskrives i UI. Den skelnen skal være brutal, ellers genopstår `product_campaign_overrides`-problemet.

### 5. Hvad du ikke har taget stilling til

Jeg har ikke taget stilling til konkret migration fra 1.0 til 2.0. Det er fase 3.

Jeg har ikke besluttet fysisk schemastruktur, navne på tabeller eller om nogle stammeområder skal ligge i separate Postgres schemas. Modellen kræver ejerskab; den kræver ikke på fase 2-niveau en bestemt fil- eller schema-struktur.

Jeg har ikke afgjort autoritetshierarkiet mellem API, klient-CRM-upload og manuel Stork-ændring i salgsvalidering. `stork-logikker-til-gennemgang.md` markerer det som åbent, og det bør Mathias/Kasper beslutte som forretningsregel.

Jeg har ikke afgjort `product_campaign_overrides`' skæbne. Jeg mener kun, at 2.0 ikke må have en UI-redigerbar pricingtabel, der ikke læses af motoren.

Jeg har ikke afgjort om `employee_client_assignments` kun er adgang eller også attribution. Dokument 1 markerer det som usikkert.

Jeg har ikke afgjort retention-perioder, arkivering/spejling/sletning for databasevækst, eller forskellen mellem `consent_log` og `gdpr_consents`.

Jeg har heller ikke afgjort `transactions` vs. `commission_transactions`, præcis rollover-lagring, eller LockOverlays. De er åbne spørgsmål i dokumenterne og bør ikke skjules i en arkitekturmodel.

### 6. Alternativer du fravalgte

Første fravalgte alternativ: **reparér 1.0 med service-lag og oprydning**. Det ville hjælpe, men det svarer ikke på rodårsagen. 1.0's problem er ikke kun at Supabase kaldes direkte. Problemet er, at autoritet er uklar: identitet har flere sandheder, rolle har flere sandheder, perioder er ikke data, pricing har UI-værdier uden motor-effekt, og audit mangler på permissions. En oprydning uden stamme-kontrakter ville blive endnu en god intention.

Andet fravalgte alternativ: **microservices eller flere databaser**. Det lyder rent, men passer dårligt til Stork. Salg, løn, dashboards, e-conomic, teamleder-DB og compliance læser samme fakta. Med to partnere og AI som primært værktøj vil flere services give deploy-, observability-, auth-, data-sync- og compliancearbejde, som ikke løser Storks nuværende rod. Stork har brug for stærkere grænser, ikke nødvendigvis flere processer.

Tredje fravalgte alternativ: **ren event sourcing for alt**. Historik og hændelser er nødvendige, men ren event sourcing over hele systemet vil gøre daglig UI-styring og debugging tungere. Jeg anbefaler i stedet immutable ledgers og livscyklus-events dér hvor de giver værdi: salg, annullering, lønperioder, pricing, integration events, audit og compliance.

Fjerde fravalgte alternativ: **klassisk stamme-og-grene uden kontrakter**. Den er tæt på Mathias' model, men for løs. 1.0 havde allerede mange gode mønstre. Det der manglede, var tvang. Derfor er mit tillæg "kontraktstyret" og "livscyklusregistre i stammen" ikke pynt; det er selve forskellen.

### 7. Proces-rapport

Jeg kørte først `git fetch --all; git pull origin main`; repoet var allerede up to date. Jeg læste derefter prompten, `docs/bibel.md`, `CLAUDE.md`, de tre Stork 2.0-dokumenter, og brugte `docs/system-snapshot.md`, `docs/ui-snapshot.md` og `docs/cross-reference.md` til teknisk evidens. Jeg brugte mest tænketid på afgrænsningen mellem stamme og grene: hvad skal være fælles sandhed, og hvad må være lokal variation.

Mit første udkast var "stamme-og-grene med service-lag". Det var for svagt, fordi det ikke forklarede hvorfor 1.0's gode intentioner smuldrede. Anden iteration blev "domæner med livscyklusser". Det var tættere på, men for abstrakt. Den endelige kerne blev: **stamme-og-grene skal være kontraktstyret, og stammen skal eje livscyklusserne**.

Den observation der tippede mig var kombinationen af tre konkrete fund: direkte Supabase-adgang udenfor hooks (`docs/cross-reference.md:2937-2941`), dobbelt permission-sandhed i hooks (`docs/ui-snapshot.md:28845-28882`) og lønperioder uden DB-lås (`docs/stork-2.0/storks-logikker.md:820-855`). De er forskellige symptomer, men samme rod: systemets vigtigste regler findes som konventioner, ikke som håndhævede kontrakter.

Jeg er mindst tilfreds med, at jeg ikke kan vurdere alle åbne forretningsvalg uden Mathias/Kasper: autoritet mellem API/CRM/Stork, retention-perioder, fysisk dataseparation og nogle gamle tabellers præcise betydning. Jeg har derfor holdt dem uden for modellen i stedet for at gætte.
