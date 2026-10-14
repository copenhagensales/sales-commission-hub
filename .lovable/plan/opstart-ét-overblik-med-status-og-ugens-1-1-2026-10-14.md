# Opstart: ét overblik med status og ugens 1-1

Ugemodellens beregning (`ramp_week_status`), alarmer og pausen, mail, løn, provision og adgang ændres ikke. Al visning bygger på `week_status`.

## Sidens rækkefølge
1. **Header:** "Opstart", kampagne-pillen og "Kun for teamledere".
   - Linjen "Uge 42 · målt til og med i går (tirsdag) · 2 af 5 arbejdsdage gået · 3 dage tilbage".
   - Et segmenteret skift "Nye i opstart · N | Hele holdet" med søgefelt og "Diskret visning" ved siden af.
   - Fanerne Alle nye / Ekstra støtte / Mangler forløb fjernes. Forsøgsordningen bliver én grå linje.
   - "Hele holdet" bliver en egen visning med den eksisterende liste for hele holdet, flyttet uændret op fra bunden.
2. **Fire tal-knapper som filtre:** START HER, HOLD FAST, PÅ SPORET og MANGLER UGENS 1-1, med dine tekster.
   - Klik filtrerer tavlen og grafen. Klik igen nulstiller.
   - De tre KPI-kort og de tre gruppekort fjernes.
   - Teksten "18 af 26 holdt" tæller alle, for hvem ugen er krævet.
3. **Grafen "Overblik: hvem ligger hvor?"** i en boks, der kan skjules og vises.
   - Åben som standard på brede skærme og lukket på mobil.
   - Valget huskes i browseren, ligesom diskret visning i dag. Det er kun en visningsindstilling.
4. **Ugetavlen** som i dag, med ny kolonne "UGENS 1-1":
   - "✓ Holdt mandag" (ugedagen for registreringen).
   - Knappen "Hold 1-1", som åbner den eksisterende feedbackdialog direkte som 1-1.
   - "Fravær".
   - "Ikke krævet".
   - Gruppen "AFVENTER STATUS · N" samler sælgere uden status, så ingen forsvinder.
   - Søgning filtrerer både tavlen og grafen.
   - Klik på en række åbner sidepanelet.
   - Kravrækken og fodnoten står under tavlen. Knappen "Om modellen" åbner en popover med forklaringen og 68/27-tallene, mærket "historik".
5. **Sidepanel med sælgerkort:** til højre på bred skærm og fuld skærm på mobil. Lukkes med X eller Esc.
   - Indhold: navn og linjen med kampagne, opstartsuge og startdato, status-pillen og DENNE UGE med bar, markør og resten af ugen.
   - UGER I OPSTART: én linje pr. opstartsuge med salg mod kravet for den uge. Den indeværende uge er markeret "nu".
   - Effektlinjen vises kun som tal pr. uge.
   - Boksen "Ugens 1-1" med status, en stor knap og "Registrér fravær hele ugen".
   - SENESTE FEEDBACK: op til 3, skrevet som almindelig tekst og aldrig som rå koder.
   - Nederst linket "Skal ikke have feedback".
6. **Den lange liste med store sælgerkort fjernes** fra standardvisningen.

## Den gamle model fjernes fra siden
Typisk spænd (p25/p50/p75-søjlerne), "Blåt felt …", trend-pillerne, det røde Ekstra støtte-mærkat på Hold fast, båndene "salget falder/stiger" og "Dag N af 40" fjernes.

Ordene ensrettes:
- "1-1" overalt.
- Fristen er altid "fredag kl. 8".
- "de" i stedet for "han/hun".

## Kun 1-1 tæller som ugens 1-1
- "1-1 lyt" fjernes som valg i dialogen og tælles ikke med på siden.
- Gamle registreringer bevares og vises som historik i feedbacklisten.
- **Opmærksomhed:** I dag tæller databasen og den ugentlige påmindelsesmail også "medlyt" som opfyldt. Da mailen ikke må ændres, retter jeg kun siden.
- Medlyt kan ikke længere vælges. Derfor bliver forskellen kun ved, hvis der allerede er registreret medlyt i denne uge. Sig til, hvis databasen og mailen også skal ensrettes i en separat opgave.

## Mandag
- `ramp_week_status` har allerede en dato-parameter ("målt pr. dato"). Siden hentes i dag med beregningen for i går.
- Jeg tilføjer et ekstra felt `last_week_status` i den læsefunktion, der henter holdets oversigt. Det kalder den samme `ramp_week_status` med datoen for sidste lørdag, altså sidste uges slutresultat.
- Der er ingen ny beregning, og den eksisterende status, flag og mail ændres ikke.
- Mandag (ingen afsluttede dage) bruger tal-knapperne, grafen og tavlen `last_week_status`. Overskriften bliver "Sidste uge (uge 41) · slutresultat · ny status i morgen".
- Kolonnen "Ugens 1-1" viser stadig denne uges 1-1.
- Det er samme regel i hele siden: viser vi sidste uge, er det kun salgstallene og statussen, der er fra sidste uge.

## Små rettelser
- **Diskret visning:** tal-knapperne viser "–", grafen og tavlens salgskolonner skjules, og sidepanelet viser kun 1-1-boksen og feedback.
- **Fortryd i ca. 8 sekunder** på "Registrér fravær hele ugen" og "Skal ikke have feedback". Fortryd sletter kun den netop oprettede registrering eller undtagelse.

## Kontrol før jeg melder færdig
- Antallet i tal-knapperne = rækker pr. gruppe i tavlen = prikker i grafen.
- "Mangler ugens 1-1" = antallet af "Hold 1-1"-knapper.
- "Hold 1-1" testes fra tavlen og fra sidepanelet. Dialogen åbner, og rækken skifter til "✓ Holdt". Afsendelse sker kun med din godkendelse, fordi den sender rigtige mails.
- Diskret visning, søgning og mandagsvisningen testes. Mandag simuleres i en test i koden og ved at sammenholde databasens `last_week_status` med det, siden viser.
- Siden gennemses i browseren på 1440 px og 390 px.

## Tekniske detaljer
- **Migration:** `get_ramp_team_overview` får et ekstra felt `last_week_status` = `ramp_week_status(..., p_as_of = sidste lørdag)`. Øvrige felter er uændrede. Ingen ændring af `ramp_week_status`, flagfunktionerne eller mailens data.
- **Filer:**
  - `RampTeam.tsx` slankes: MemberCard, WeeklyBars og fanerne fjernes fra visningen.
  - Nye komponenter: `RampKpiFilters`, `RampSellerPanel` (Sheet) og `RampAboutModel` (Popover).
  - `RampOverviewMatrix.tsx` får 1-1-kolonnen, gruppen "Afventer status", søgning, sammenfoldning og mandagskilde.
  - `useRampTeam.ts` får typen `last_week_status`.
  - `rampWeek.ts` får en hjælper til valg af visningsuge med test.
- **Fortryd** bruger de eksisterende mutationer: en ny sletning af egen netop oprettet fraværsregistrering via eksisterende rettigheder, og fjernelse af undtagelsen. Kræver det en ny rettighed, stopper jeg og spørger.
- Ubrugte komponenter fjernes fra filen efter build.
