# Dagsrapporter: "Ingen registreringer fundet" ved måned/periode

## Hvad der sker (bekræftet, ikke gætteri)

Din mistanke holder: det er datamængden. Databasen afbryder forespørgslen, og siden viser fejlen som om der ikke var nogen data.

Evidens fra databasens log i dag kl. 13:28–13:29 — to forespørgsler afbrudt med "statement timeout", og de kommer begge fra Dagsrapporter:

1. Et opslag der henter **alle field marketing-salg nogensinde** med hele deres rådata, uden datofilter og uden kundefilter — 18.728 salg hentet 500 ad gangen (ca. 38 kald i træk). Det bruges kun til at markere medarbejdere i filterlisten, men kører hver gang en kunde er valgt.
2. Et opslag der henter sælgernes mails for den valgte kunde i perioden, men sorteret efter oprettelsestidspunkt i stedet for salgsdato, med side-for-side gennemløb af hele tabellen (66.476 salg i alt).

Derudover henter rapporten alle field marketing-salg i perioden med rådata og varelinjer og frasorterer først kunden bagefter i browseren. For 15. aug.–14. sep. er det 1.925 salg og 8.909 varelinjer, mod nogle få hundrede for én dag. Det forklarer præcis hvorfor én dag virker og en måned ikke gør.

Når et af opslagene afbrydes, kaster hele beregningen fejl, og siden falder tilbage til en tom liste. Den viser "Ingen registreringer fundet", fordi der slet ikke findes en fejltilstand i visningen — kun "henter", "tom" og "data". Man kan altså ikke se forskel på "ingen data" og "det gik galt".

## Løsning i tre trin

**Trin 1 — vis sandheden (lille, ingen tal ændres)**
Tilføj en fejltilstand: hvis opslaget fejler, står der at rapporten ikke kunne hentes, med en "Prøv igen"-knap — i stedet for "Ingen registreringer fundet". Fjern samtidig det sted hvor en fejl i salgsopslaget stiltiende bliver til nul salg, så et delvist resultat ikke kan vises som et rigtigt tal.

**Trin 2 — hent kun det der skal bruges (fjerner årsagen i praksis)**
- Læg dato- og kundefilteret ned i databasen på field marketing-salgene, i stedet for at hente alt og filtrere i browseren.
- Hold op med at hente hele rådata-feltet; hent kun sælger-id og kunde-id.
- Sortér og bladr efter salgsdato (der findes indeks på det) i stedet for oprettelsestidspunkt.
- Lad filterlistens markering af "medarbejdere med aktivitet" bruge samme periode som rapporten, så den ikke længere skanner alle salg nogensinde.

Dette alene bringer datamængden ned fra titusinder til nogle få hundrede rækker pr. søgning.

**Trin 3 — flyt opgørelsen til databasen (den permanente løsning)**
Én opgørelses-funktion i databasen, der returnerer én række pr. medarbejder pr. dag (timer, sygdom, ferie, antal salg, provision, omsætning, kunder) for det valgte filter, så browseren kun modtager det færdige resultat. Samme mønster som det der gjorde Tryg-rapporten hurtig (7,5 sek. → under 0,3 sek.).

## Kontrol før og efter

Tallene må ikke ændre sig. Kontrolmåling på tre søgninger — i dag, seneste uge og 15. aug.–14. sep. for Eesy FM — hvor totaler pr. medarbejder (timer, salg, provision, omsætning) skal være identiske før og efter, og svartiden måles. Trin 1 og 2 ændrer kun hentningen og visningen, ikke nogen beregning. Trin 3 må først slås til, når kontrolmålingen er godkendt.

## Teknisk

- Fil: `src/pages/reports/DailyReports.tsx` — `fetchEmployeesWithClientActivity` (linje 30-72), `salesForClient`/`fmSellersForClient` (linje 393-415), FM-hentningen (linje 765-789), det slugte `catch` (linje 674-677), og tom-tilstanden (linje 1421-1428, `isError` bruges ikke i dag).
- `fetchAllRows` bruger `orderBy: "created_at"` som standard og OFFSET-paginering; skift til `sale_datetime` eller `fetchAllRowsCursor` for disse kald.
- Trin 3: ny `SECURITY DEFINER`-funktion, fx `get_daily_report(p_start, p_end, p_employee_ids, p_client_ids)`, med adgangstjek svarende til `scopeReportsDaily`; indeks tjekkes med `EXPLAIN` før og efter.
- Ingen ændringer i lønberegning, provision, prisregler eller gemte data.
