# Trin 3 for Dagsrapporter — ulemper og en sikrere vej

Kort svar: ja, der er ulemper. Trin 3 er den rigtige langsigtede løsning, men det er et større indgreb end trin 1 og 2, og det rører et område hvor tallene bruges til løn og timer.

## Ulemperne ved trin 3

1. **Beregningen bliver skrevet om ét sted mere.** Dagsrapporten regner i dag timer, fravær, vagter, salg, provision og omsætning sammen i browseren. Flytter vi det til databasen, findes reglerne to steder, indtil det gamle slettes. Det er præcis den slags dobbelt sandhed, der får tal til at glide fra hinanden over tid.
2. **Risiko for stille taldrift.** Reglerne om vagter, fravær, deling af dage og afrunding er detaljerede. En lille forskel i databasens udgave kan give en anden timeafregning uden at nogen bemærker det. Det er en lønrelateret side, så det er den alvorligste ulempe.
3. **Det er ikke en lille opgave.** Siden er ca. 1.780 linjer med omkring femten forskellige opslag. En fuld flytning bliver stor at gennemgå og kan ikke rulles tilbage med et enkelt klik, når databasedelen først er i brug.
4. **Adgangsreglerne skal skrives om.** I dag afgør siden selv, hvad en teamleder må se. Det skal flyttes ind i databasen, og en fejl der giver en teamleder for bred adgang til andres tal.
5. **Nye vagter og fravær skal med med det samme.** Databasedelen må ikke cache noget, ellers kan en nyoprettet vagt mangle i rapporten.

## Hvad der taler for

Søgningen tager 41,5 sekunder i dag. Den fejler ikke længere stille, men den er langsom nok til at ramme databasens tidsgrænse igen på travle dage og på længere perioder. Så vi kan ikke lade det stå som det er.

## Forslag: del trin 3 i to, og tag kun det første nu

### Trin 3a — hurtigere uden at flytte beregningen (anbefalet først)

Beregningen bliver liggende, hvor den er. Vi gør kun hentningen billigere:

- Hent de uafhængige opslag samtidig i stedet for ét ad gangen (salg, vagter, fravær, tidsregistreringer).
- Hent større sider ad gangen, så en måned kræver få kald i stedet for mange.
- Hent kun de felter der faktisk bruges i de resterende opslag, som vi gjorde med field marketing-salgene.
- Slå sælgerlisten op én gang pr. søgning i stedet for pr. kunde.

Forventet effekt: fra 41,5 sekunder til anslået 8–15 sekunder. Ingen regel flyttes, ingen adgangsregel ændres, alle tal er de samme celler som før — derfor er risikoen lav, og en fejl er let at rulle tilbage.

Hvis 3a ikke er nok, vender jeg tilbage med et selvstændigt forslag — intet af det ligger i denne godkendelse.

## Teknisk

- Fil: `src/pages/reports/DailyReports.tsx`. Trin 3a ændrer kun rækkefølgen og omfanget af opslagene i `reportData`-useQuery (linje 399 og frem) og i `fetchEmployeesWithClientActivity` (linje 28-72): uafhængige opslag samles i `Promise.all`, `fetchAllRows` får `pageSize: 1000`, og select-listerne skæres ned til de felter der læses.
- `get_distinct_agent_emails_for_client` kaldes i dag én gang pr. valgt kunde (linje 49); det samles til ét kald pr. søgning.
- Ingen ændringer i databasen, i lønberegning, prisregler, provision eller gemte tal.
- Kontrol: svartid måles på den faktiske side, og totaler pr. medarbejder (timer, salg, provision, omsætning) sammenlignes mod databasen for tre søgninger — i dag, seneste uge og 15. aug.–14. sep. for Eesy FM — og skal være identiske før og efter.
