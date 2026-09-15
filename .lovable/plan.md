# Opret nye medarbejdere direkte fra opstartsholdet

## Problemet

Login sker nu udelukkende med Microsoft-konto, og der oprettes ikke automatisk brugere ved første login. Den gamle metode sendte et link, som personen selv skulle bruge — det virker ikke længere. Derfor kan nye ikke komme ind.

Bekræftet i systemet: loginsiden tilbyder kun Microsoft-login, og fejllogen viser "sign ups are disabled", dvs. personen skal være oprettet i forvejen med præcis den mail, de logger ind med.

## Løsningen

En knap ved hver deltager på et opstartshold — dér hvor der står "Tilmeldt" — der på ét klik gør personen til medarbejder og giver adgang.

### Sådan virker knappen

1. Man klikker "Opret bruger" ved deltageren.
2. En lille boks åbner med to felter, udfyldt på forhånd:
   - Copenhagensales-mail (hentet fra deltagerens mail på holdet, kan rettes)
   - Startdato (hentet fra holdets startdato, kan rettes)
3. Ved bekræftelse sker følgende:
   - Kandidaten bliver oprettet som medarbejder med navn, privat mail, telefon, stilling, hold og startdato
   - Copenhagensales-mailen sættes som arbejdsmail
   - Der oprettes en brugerkonto på præcis den mail, så Microsoft-login virker med det samme
   - Personen får standardrollen medarbejder
   - Kandidaten markeres som i onboarding
4. Der sendes en velkomstmail til personens private mail.

Mangler Copenhagensales-mailen, kan den skrives i boksen. Uden mail kan der ikke oprettes.

Trykker man igen på en person, der allerede er oprettet, sker der ingen skade: eksisterende medarbejder og konto genbruges, intet dubleres.

### Velkomstmailen

Sendes fra vores egen Copenhagen Sales-mail i samme stil som de øvrige mails og indeholder:

- Velkommen og startdato
- At man logger ind med sin Copenhagensales-mail
- At standardkoden er Copenhagensales2, medmindre man selv har ændret den
- Knap/link til forsiden: https://stork.copenhagensales.dk

### Den gamle invitationsmail

"Start hold og send invitationer" holder op med at sende link-mails. Den opretter fortsat medarbejdere og hold som i dag, men uden den mail der ikke længere virker. Selve den gamle mailfunktion bliver ikke slettet, så historikken bevares.

## Teknisk

- Ny edge function `activate-employee-account`: kun ledere og opefter (`requireManager`), validering af input, opslag i `auth.users` før oprettelse, `createUser` med `email_confirm: true` og en tilfældigt genereret adgangskode (Stork bruger ikke kodeord — login går gennem Microsoft), sætter `auth_user_id` på medarbejderen, sikrer rolle `medarbejder`, og sender velkomstmail via det eksisterende M365 Graph-flow. Idempotent på mailadressen.
- `src/lib/cohortMemberProcessing.ts` udvides med `workEmail` + `startDate` og kalder `activate-employee-account` i stedet for `send-employee-invitation`. Både holdstart og enkelt-knappen bruger samme funktion (én sandhed).
- `src/pages/personnel/UpcomingStarts.tsx`: ny knap i deltagerrækken ved statusbadget, plus en lille dialog med mail + startdato. Dialogen kan kun lukkes med Annuller eller Opret.
- Ingen ændringer i database-skema, RLS, løn, provision, pricing eller historiske tabeller.
- `work_email` sættes kun, hvis feltet er tomt eller identisk med det indtastede, så eksisterende mails ikke overskrives ved gentagne klik.

## Risici

- Er Copenhagensales-mailen skrevet forkert, kan personen ikke logge ind; den kan rettes bagefter med det eksisterende mailrettelses-flow.
- Microsoft-kontoen skal være oprettet i M365 af IT; Stork kan ikke oprette den. Mailen om standardkoden gælder den konto.
