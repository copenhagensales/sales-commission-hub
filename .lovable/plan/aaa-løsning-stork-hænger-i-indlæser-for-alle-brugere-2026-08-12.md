# AAA-løsning: Stork hænger i "Indlæser..." for alle brugere

## Symptom
Flere brugere kommer ikke ind — siden står i "Indlæser..." med kun en "Log ud"-knap.

## Rod-årsag (verificeret, to lag)

**Lag 1 — databasen (den direkte årsag).**
Adgangsreglen `Employees can view active colleagues` på `public.employee_master_data` slår op i **samme tabel** i sin egen betingelse:

```text
is_active = true AND EXISTS (
  SELECT 1 FROM employee_master_data me
  WHERE me.auth_user_id = auth.uid() AND me.is_active = true
)
```

Postgres skal evaluere reglen for at læse tabellen — og evalueringen kræver at læse tabellen. Resultat: `42P17 infinite recursion detected in policy for relation "employee_master_data"` og HTTP 500 på **hver** forespørgsel mod stamdata. Bekræftet i live-netværkslog (flere hundrede 500-svar) og i `pg_policies`.

Alle øvrige 10 politikker på tabellen bruger `SECURITY DEFINER`-funktioner (`is_owner`, `can_view_employee`, `is_rekruttering`, `is_fieldmarketing_leder`, `is_teamleder_or_above` — alle verificeret `prosecdef = true`). Kun denne ene politik bryder mønsteret. Det er altså en enkeltstående afvigelse fra en ellers konsistent arkitektur, ikke et systemisk designproblem.

**Lag 2 — frontenden (derfor "hænger" i stedet for at fejle).**
Login-/bootstrap-flowet slår brugerens egen stamdatarække op (bl.a. `must_change_password`). Når kaldet fejler, har flowet ingen fejl-terminal tilstand: det bliver i "loading" og forsøger igen. Netværksloggen viser samme forespørgsel gentaget 40+ gange i under 2 sekunder. Selv efter DB-fixet er dette en reel svaghed: enhver fremtidig backend-fejl vil igen give en uendelig loader i stedet for en handlingsbar fejlbesked.

En løsning der kun retter lag 1 er en lappeløsning: den fjerner dagens symptom, men efterlader systemet lige så skrøbeligt næste gang.

## Løsningen (tre dele)

### Del 1 — Fjern rekursionen ved kilden
Opret `public.is_active_employee(_uid uuid)` som `SECURITY DEFINER`, `STABLE`, med fast `search_path = public`. Den besvarer "er denne auth-bruger en aktiv medarbejder?" uden at trigge RLS, og kan derfor ikke rekursere.

Erstat politikken med samme forretningsregel, men uden selv-opslag:

```text
is_active = true AND public.is_active_employee(auth.uid())
```

Adgangsniveauet er **uændret**: aktive medarbejdere ser aktive kollegaer. Funktionen får kun `EXECUTE` til `authenticated` — `anon` revokeres eksplicit, i tråd med den sikkerhedsoprydning der blev gennemført tidligere.

Herefter følger alle 11 politikker på tabellen samme mønster: ingen inline-opslag i egen tabel.

### Del 2 — Sikring mod at det sker igen (det der gør løsningen AAA)
Selv-refererende politikker er svære at opdage: de fejler først i produktion, og de fejler totalt. Vi tilføjer en permanent detektor:

- `public.check_rls_self_reference()` (`SECURITY DEFINER`, kun `authenticated`, kun læsning af `pg_policies`) returnerer alle politikker hvis betingelse nævner sin egen tabel — altså kandidater til rekursion.
- Resultatet vises som et kort i **Admin → Security Dashboard**: grønt når listen er tom, rødt med tabel- og politiknavn når den ikke er.

Dermed bliver fejlklassen synlig for ejer med det samme i stedet for at ramme 100+ brugere først. Det er ét opslag, ingen løbende omkostning, ingen ny infrastruktur.

### Del 3 — Bootstrap må ikke kunne hænge
I login-/bootstrap-flowet:

- Opslaget af egen stamdatarække får en eksplicit fejl-tilstand og et loft på antal forsøg, i stedet for uendelige gentagelser.
- Ved fejl vises en konkret besked ("Kunne ikke hente din profil — prøv igen / log ud") med en genforsøg-knap, frem for "Indlæser...".
- Ingen forretningslogik ændres: en bruger der kan hentes, kommer ind præcis som i dag.

## Hvorfor ikke andre løsninger

- **Rul politikken tilbage / slet den.** Ville fjerne kollega-synlighed (Head-to-Head, avatarer, teamvisninger) og dermed skabe en ny fejl. Afvist.
- **Deaktivér RLS på tabellen.** Ville eksponere CPR- og bankoplysninger. Aldrig.
- **Kun rette politikken uden Del 2 og 3.** Retter dagens 500-fejl, men systemet er lige så blindt næste gang og hænger stadig i stedet for at fejle synligt. Det er definitionen på en lap.

## Kendt punkt, ikke omfattet her
Kollega-politikken giver adgang til hele rækken — også følsomme felter (CPR, bank). Det er et tidligere bevidst accepteret forhold og ændres **ikke** i denne opgave, fordi et felt-snit rører 50+ filer der læser `employee_master_data` direkte og skal have sin egen plan og godkendelse. Jeg kan lave et separat forslag om et `security_invoker`-view (navn, avatar, team) til kollega-visning og en indsnævret politik, når denne fejl er lukket.

## Verifikation før "færdig"
1. `pg_policies` på `employee_master_data`: ingen politik nævner egen tabel i sin betingelse.
2. Live-forespørgsel mod stamdata som almindelig medarbejder: 200 med rækker (ikke 500).
3. `check_rls_self_reference()` returnerer 0 rækker på hele databasen.
4. Preview: "Alle medarbejdere" og "Personale" viser medarbejdere igen; login gennemføres uden hængende loader.
5. Negativ test: aktiv medarbejder kan se aktive kollegaer; inaktive rækker er stadig skjult for ikke-ledere.

## Teknisk sammenfatning
- Én migration: `is_active_employee(uuid)` + `check_rls_self_reference()` (begge `SECURITY DEFINER`, `SET search_path = public`, `REVOKE ALL FROM anon`, `GRANT EXECUTE TO authenticated`), `DROP POLICY` + `CREATE POLICY` på `public.employee_master_data`.
- Frontend: fejl-/genforsøgstilstand i auth-bootstrap; nyt statuskort i Security Dashboard.
- Zone: rød (auth/RLS + persondata) — derfor plan først, ingen ændringer før godkendelse.
