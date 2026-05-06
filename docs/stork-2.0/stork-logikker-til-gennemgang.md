# Stork — Alle logikker til gennemgang

Arbejdsdokument til at samle alle logikker ét sted før Stork 2.0 designes. Ikke en endelig version — et grundlag for at markere hvad der står fast, finde huller, og omformulere efter den nye salgs-livscyklus-tænkning.

---

## Indhold

1. Sandhed og data
2. Salgets livscyklus
3. Annullering
4. Salgsvalidering — de 3 inputs
5. Provision og løn
6. Identitet
7. Klient, produkt og pris
8. Tid og perioder
9. Roller og rettigheder
10. Stamme og grene
11. UI som styringspanel
12. Dashboards som selvstændigt modul
13. Kode-arkitektur
14. Compliance og lovgivning
15. Hvad mangler

---

## 1. Sandhed og data

Det grundlæggende: hvor lever sandheden, og hvordan beskytter vi den.

**Faste logikker:**
- Databasen er sandheden. Alt andet (dashboards, rapporter, TV-boards, UI) er views af samme sandhed.
- Hvis en rapport og databasen er uenige, er rapporten forkert — ikke databasen.
- Historik bevares altid. Historiske data må ikke ændres retroaktivt uden eksplicit strategi.
- Ved behov for rettelse: ny række med reference, ikke UPDATE på den gamle.
- Single source of truth — også i koden. Samme forretningsregel må kun eksistere ét sted.
- Views og realtime sync holder sandheden konsistent på tværs af sessioner.

**Konsekvens:**
- Al forretningslogik skal kunne genudledes fra DB-data.
- Beregninger må ikke gemme afledte værdier uden at kunne regenerere dem.
- Cross-session ændringer (pricing, mappings) skal broadcastes.

---

## 2. Salgets livscyklus

Hvordan et salg lever fra det fødes til det er færdigt.

**Faser:**
- Optaget → Beriget → Godkendt

**Endepunkter:**
- Godkendt (lås)
- Annulleret (lås — kan ramme fra Beriget og frem)

**Faste logikker:**
- Hver fase er låst når salget passerer den.
- Berigelse er ikke ændring — det er fuldførelse.
- Stammer har faser, ikke kun værdier.
- Salgets livscyklus er rigere end "udbetalt: ja/nej".
- Udbetaling er IKKE en del af salgets livscyklus. Det tilhører lønnens egen verden.

**Berigelses-eksempel:**
- t=0: agent_email, sale_datetime, product_id (basis-fakta, lås)
- t=1: mapping fundet → mapped_commission udfyldes (lås)
- t=2: kampagne-berigelse → matched_pricing_rule_id (lås)

---

## 3. Annullering

Behandles som separat dimension, ikke som fase i salget.

**Faste logikker:**
- Annullering kan ramme uanset hvor salget er i livscyklen.
- Annullering har sit eget liv: Optaget → Behandlet → Afgjort (godkendt fradrag / afvist / udskudt).
- cancellation_queue er separat tabel.
- Annullering ændrer økonomisk konsekvens uden at ændre at salget fandt sted.
- Et udbetalt salg kan annulleres → fradrag i kommende lønperiode.

**Visualisering:**
```
                     LIVSCYKLUS
Optaget → Beriget → Godkendt
   ↓        ↓          ↓
   └────────┴──────────┘
            ANNULLERING (krydser alt)
```

---

## 4. Salgsvalidering — de 3 inputs

Logik om hvem der har autoritet til at ændre status på et salg.

**De 3 kilder:**
- **API** (dialeren — Adversus/Enreach sender salget ind)
- **CRM** (klientens system — Excel-upload med deres godkendelse/afvisning)
- **Stork** (manuel ændring i internt system)

**Faste logikker:**
- Tre forskellige systemer kan ændre status — det er en stamme-logik
- Eksisterer i dag som `/economic/sales-validation`
- Excel uploades for at godkende, rette, annullere, afvise salg via match-logik
- Separat fra cancellation-matching, men beslægtet

**Åbne beslutninger:**
- Autoritets-hierarki ved konflikt mellem de 3 kilder
- Hvilke kilder må flytte salget mellem hvilke faser
- Hvordan koblingen til de 3 livscyklus-faser konkret virker

---

## 5. Provision og løn

Hvordan provision opstår og hvordan den udmøntes.

**Faste logikker:**
- Provision registreres ved salgstidspunkt — motivation hos sælger er vigtigere end timing-præcision mod e-conomic.
- Lønperiode låses ved udbetaling.
- Lønnen er et separat system der læser salgets sandhed for en periode.
- Salget ved ikke noget om løn.
- Lønunderskud ruller over. Ingen negativ løn. Afskrives ved medarbejder-stop.
- Teamleder-DB beskyttes — uinddrivelige beløb fra stoppede medarbejdere tæller ikke mod.
- Afstemning mod e-conomic sker bagud via Revenue Match.

**Lønnens livscyklus (forslag — ikke vedtaget):**
- Lønperiode oprettes (åben)
- Lønperiode beregnes (snapshot af salg-tilstand)
- Lønperiode godkendes (intern kontrol)
- Lønperiode udbetales (lukket, men reference til snapshot bevares)

**Åbne beslutninger:**
- Formel periode-låsning i databasen (ikke kun kode-konvention)
- Hvilke data-typer skal have historisk tilstand gemt (løn-snapshots, team-skift, klient-ejerskab)?

---

## 6. Identitet

Hvordan personer er repræsenteret på tværs af systemet.

**Faste logikker:**
- Én medarbejder kan have flere identiteter (work_email, private_email, dialer-emails, dialer-IDs).
- Samme email kan ikke tilhøre to medarbejdere.
- Identitet vokser over tid efter klare regler — det er ikke ændring, det er tilføjelse.
- Sælger fratræder = identiteter fryses.

**I dag (problem):**
- Tre parallelle identiteter: employee_master_data, agents, sales.agent_email.
- 4-trins fallback i navne-resolver.
- Ingen FK-constraint sikrer integritet.
- 50+ filer rører agent-identitet uden om central resolver.

**Åbne beslutninger:**
- Skal employee_identities være single source eller derivat af work_email/private_email?
- Hvordan opdateres enrich_fm_sale-trigger synkront med ny resolver?
- Hvordan håndteres existing employee_identity (singular) tabel fra december 2025?

---

## 7. Klient, produkt og pris

Hvordan vi tager imod, prissætter og håndterer kunde-dimensioner.

**Faste logikker:**
- Klient er dimensionen — brand udfases gradvist.
- Brand lever stadig i FM-booking.
- Hierarki: clients → client_campaigns → products → product_pricing_rules.
- Pricing-motoren er rød zone. Fejl rammer hundredvis af udbetalinger.
- Frontend og edge pricing skal være synkroniseret 1:1.

**Åbne beslutninger:**
- product_campaign_overrides skæbne — 76 aktive rækker, aktiv UI, men læses ikke af pricing-motoren. Slet og migrér eller behold som manuel override?
- Tie-breaker ved identisk priority — i dag tilfældigt.
- Håndtering af manglende subsidy-data fra dialer.
- Sikring mod drift mellem frontend og edge pricing (ingen automatisk diff-test).

---

## 8. Tid og perioder

Hvordan tid er repræsenteret i systemet.

**I dag:**
- sale_datetime = primært tidsstempel for salg.
- Lønperiode 15→14 hardkodet i helpers — findes ingen steder som data.
- Uge = booking.week_number + year.
- Måned = client_monthly_goals.year_month (string uden DB-validering).
- Ingen period_locks-tabel — låsning er kun kode-konvention.
- Tidszone-risiko ved salg kl. 23:30.

**Åbne beslutninger:**
- Formel period_locks-tabel.
- Tidszone-håndtering ved midnat-salg.
- Strategi for database-størrelse (arkivering, spejling, sletning).

---

## 9. Roller og rettigheder

To dimensioner: rolle × team.

**Faste logikker:**
- Rolle bestemmer hvilke dele af systemet en bruger må se.
- Team bestemmer hvilken data inden for det.
- Mindst 2 superadmins altid (erstatter de 5 hardkodede ejer-bypass).
- Rolle, afdeling og seniority er tre forskellige dimensioner — ikke én.
- Hardkodede rolle-keys (`if (role === 'ejer')`) må ikke introduceres i ny kode.

**I dag (problem):**
- 10 roller defineret. Hardkodet ejer-bypass 5 steder.
- 69 hardkodede rolle-referencer i 8 filer.
- 6 roller har samme priority (100) — ingen reel rangordning.
- DB-trigger kollapser 10 roller til 5 i RLS-policies.
- "Stab" findes som job-title men IKKE som system-rolle.

**Åbne beslutninger:**
- Konsolider medarbejder + fm_medarbejder_ (96,9% identiske).
- Differentiér de 6 roller med priority=100.
- Lovpligtige roller (AMO-ansvarlig, GDPR-ansvarlig, økonomi-ansvarlig).
- Backoffice-rollens skæbne (0 aktive brugere).
- Ret trailing underscore i fm_medarbejder_.

---

## 10. Stamme og grene

Den overordnede arkitektur — det vigtigste princip for Stork 2.0.

**Faste logikker:**
- Stamme = database, faste låste logikker (aldrig diskuteres væk).
- Grene = applikationer (UI, lokal præsentation, fri til variation inden for rammer).
- Stamme-forbedringer gavner alle grene samtidig.
- Første prioritet i 2.0 = stammen. Grene arver stammens kvalitet.

**Vigtig præcisering om grupperingen:**
- **Pile er farlige** — antyder lineær flow der ikke matcher virkeligheden
- **Grupperinger viser HVAD ting er, IKKE hvordan de hænger sammen**
- Sammenhænge på tværs lever i stammen via koblinger — ikke i organisationen

### De 16 grene under 5 hovedoverskrifter

**Status:** Foreløbig liste — udgangspunkt der forbedres løbende.

**Forretningsdrift:**
- Salg
- Field Marketing
- Marketing (employer-marketing mod ansøgere)
- Rekrutering

**Mennesker:**
- Onboarding (egen gren — ikke under medarbejder)
- Medarbejder
- Gamification

**Penge:**
- Løn
- Ejere (økonomi) — inkl. e-conomic

**Indsigt:**
- KPI og data
- Dashboard
- Rapportering
- Test og målinger (inkl. Pulse Survey)

**Fundament:**
- Database/API
- Mapping
- Compliance (inkl. AMO, GDPR, Kontrakter, Code of Conduct)

**Åbne beslutninger:**
- Stammens præcise afgrænsning (er employee_master_data stamme eller gren?)
- Skal Salg være egen hovedoverskrift?
- Hvor hører Field Marketing — under Salg eller Forretningsdrift?
- Hvordan håndhæves stamme-reglerne på grenene?
- Hvornår må en gren have lokale afvigelser fra stammen?

---

## 11. UI som styringspanel

Hvordan systemet skal kunne administreres.

**Faste logikker:**
- Alt skal kunne administreres via UI.
- Når 2.0 er færdig: prompts bruges kun til ny funktionalitet eller refaktor.
- Prompts bruges ikke til løbende drift.
- UI giver superadmins kontrol uden kode-ændringer.

**Konsekvens:**
- Hver stamme-funktion skal eksponeres via UI for superadmins.
- Konfiguration ligger i database, ikke i kode.
- Justering af logikker (priser, regler, mappings) sker i UI med audit-trail.

---

## 12. Dashboards som selvstændigt modul

Specifik gren med eget rettighedssystem.

**Faste logikker:**
- Eget rettighedssystem — arvet ikke fra centralt system.
- Kun "administrer indstillinger" arves fra centralt system.
- TV-link er spejl af moder-dashboard, ikke separat kopi.
- Ændring i moder-dashboard reflekteres automatisk i TV-link.
- Lokale data-principper per dashboard.

**I dag:**
- 13 dashboards eksisterer.
- Vision, ikke nuværende tilstand.

---

## 13. Kode-arkitektur

Hvordan koden skal være struktureret.

**Faste logikker:**
- Data-adgang går gennem service-lag. Komponenter tilgår aldrig Supabase direkte — altid via custom hook med React Query.
- Konsolidering er ikke nok — oprydning er nødvendig.
- Skygge-kode er teknisk gæld der akkumulerer rente.
- Forståelse før handling.

**Forbudte mønstre i ny kode:**
- `supabase.` direkte i JSX
- `useEffect + useState + supabase` (manuel fetch)
- `: any` (brug Database-typer)
- Efterladte `console.log`
- Hardkodede rolle-keys
- Duplikeret pricing-logik frontend vs. edge
- Query keys uden central registrering
- `localStorage` til business-data (kun UI-prefs)

**Åbne oprydnings-opgaver:**
- 855 forekomster af `: any`
- 182 efterladte console.log
- 146 komponenter der kalder supabase direkte
- Centralisering af query keys
- Testdækning for kritiske beregninger
- Opsplit af MgTest.tsx og UploadCancellationsTab.tsx

---

## 14. Compliance og lovgivning

Hvad systemet juridisk skal kunne.

**Lovgivning der gælder:**
- GDPR (persondata, CPR, bank)
- EU AI Act (intern AI-politik)
- Bogføringsloven (5 års opbevaringspligt)
- Arbejdsmiljøloven (AMO-dokumentation)

**Faste logikker:**
- Retention-politik er ikke valgfri — den er lovpligtig.
- AMO-modul er bygget og kører.
- GDPR-infrastruktur er delvist bygget (gdpr-edge-functions, consent-logging).
- Sletningsregler eksisterer for nogle data-typer.

**Åbne beslutninger:**
- GDPR-sletning af kandidater efter konfigureret periode (ikke fuldt automatiseret).
- Vagt-overlap validering i database-lag (kun UI-valideret i dag).
- Forskellen mellem consent_log og gdpr_consents (uafklaret).

---

## 15. Hvad mangler

Logikker der ikke er beskrevet endnu — kandidater til næste runde.

**Stammer der mangler livscyklus-beskrivelse:**
- Identitet (faser fra oprettelse til frysning)
- Pricing (faser fra oprettelse til udfasning)
- Lønperiode (faser fra åben til udbetalt)
- Klient/produkt (faser fra introduktion til udfasning)

**Regler der mangler:**
- Hvordan stammen håndhæves på grenene
- Hvornår en gren må afvige fra stammen
- Berigelses-strategier per stamme (hvem må berige, hvornår)
- Hvad der sker når en stamme ændres (migration-strategi)

**Spørgsmål Lovable rejste der ikke er besvaret:**
- LockOverlays — hvad bruges de til?
- Forskellen mellem transactions og commission_transactions
- Trailing underscore i fm_medarbejder_
- 12 skygge-funktionaliteter generelt
- 5 hot spots: pricing, lønberegning, sales-attribution, permission-resolution, cache-invalidation

---

*Senest opdateret: 29. april 2026*
*Status: Arbejdsdokument til gennemgang. Ingen logik er endelig før den er markeret som fast.*
