# "Opret bruger" skal genbruge et eksisterende stamkort

## Hvad der sker (bekræftet)

Oliver Lyng Christensen har **allerede et stamkort** i Stork (aktiv, Eesy TM, arbejdsmail `olic@copenhagensales.dk`, privat mail `oliverlyngchristensen@gmail.com`) — men **ingen loginkonto** (`auth_user_id` er tom, status "afventer").

Knappen "Opret bruger" i Kommende Opstarter forsøger altid at oprette et **nyt** stamkort (`src/lib/cohortMemberProcessing.ts`, linje 100-117). Databasens dublettospærring (`trg_prevent_duplicate_employee`) afviser det korrekt, og du får beskeden "Denne medarbejder findes allerede".

Så fejlen er reel og beskyttende: den forhindrer en dublet. Men flowet mangler den anden vej — at genbruge det stamkort, der allerede findes.

## Ændring

I `processCohortMember`:

1. Slå op med den eksisterende `findExistingEmployeeByEmail` (arbejdsmail + privat mail) **før** oprettelse.
2. **Findes ingen:** som i dag — opret nyt stamkort.
3. **Findes én:** genbrug den i stedet for at oprette:
   - genaktivér kun hvis medarbejderen er inaktiv
   - udfyld kun **tomme** felter (jobtitel, privat telefon, privat mail, startdato) — eksisterende værdier overskrives ikke
   - sikr holdtilknytning via den eksisterende `ensureTeamMembership`
   - kobl deltageren på opstartsholdet til det eksisterende stamkort
   - kør samme oprettelse af loginkonto + velkomstmail som i dag
4. Er den fundne medarbejder allerede koblet til en **anden** loginkonto end arbejdsmailen, stopper vi med en klar besked i stedet for at ændre loginkontoen.

Resultatet: knappen virker både for helt nye og for dem der allerede har et stamkort, uden at der nogensinde opstår dubletter.

## Bevares uændret

Dublettospærringen i databasen, dublettjekket i "Opret ny medarbejder", løn, provision, pricing, rettigheder, RLS, historiske tabeller og alle eksisterende mails. Ingen migration, intet skemaskift.

## Teknisk

- Fil: `src/lib/cohortMemberProcessing.ts` (genbrugsgren i `processCohortMember`).
- Genbruger `findExistingEmployeeByEmail` og `ensureTeamMembership` — ingen ny parallel logik.
- Opdateringen er betinget (`is null`-tjek pr. felt), så eksisterende data ikke overskrives.
- Loginkontoen oprettes fortsat i edge-funktionen `activate-employee-account`, som allerede er idempotent på arbejdsmailen.

## Verifikation

- Typecheck.
- Oliver: "Opret bruger" skal nu lykkes, genbruge hans stamkort, give ham en loginkonto og sende velkomstmail til hans private mail.
- Kontrollér at der stadig kun findes ét stamkort på hans mails, og at hold, klienter og jobtitel er uændrede.
