# Sebastians login-fejl — ikke relateret til teamændringen

## Kort svar

Nej. Ændringen jeg lavede var udelukkende dropdown-listen i "Rediger team" (`TeamsTab.tsx`). Den rører ikke login, auth eller rettigheder.

Kodeordet kan ikke læses nogen steder — det gemmes kun som envejs-hash i auth. Du kan kun sætte et nyt.

## Hvad jeg kan se i data

- Hans auth-konto findes med e-mail **sebastianbangsbopetersen@gmail.com** (privat-mailen). Kontoen er **ikke låst** (`account_locked = false`, `failed_login_count = 0`), og han er aktiv.
- `login_events` har **nul** rækker for ham — han er aldrig kommet igennem et login.
- Auth-loggen viser flere `400: Invalid login credentials` kl. 13:33–13:34 i dag, samt en admin-opdatering af hans bruger kl. 13:34:32 (kodeord sat fra Stork).
- Login-siden slår **ikke** arbejdsmail om til auth-mail: opslaget `get_auth_email_by_work_email` er kommenteret ud i `src/pages/Auth.tsx:491-519` ("DISABLED DURING EMERGENCY").

Forsøger han at logge ind med **svb@copenhagensales.dk**, findes den mail ikke i auth, og han får "Forkert login — forkert email eller adgangskode". Det er den mest sandsynlige forklaring.

## Ja, du kan sætte en ny kode selv

På hans medarbejderprofil, i knapperækken øverst til højre, er der tre knapper (`EmployeeDetail.tsx:582-673`):

- **Sæt ny kode** (hængelås) — du indtaster selv kodeordet, det sættes med det samme. Kræver redigeringsret til medarbejdere. Dette er den du skal bruge.
- **Nulstil kode** (nøgle) — sender en nulstillingsmail til hans privat-mail i stedet.
- **Nulstil login** (pil) — rydder kun mislykkede loginforsøg/kontolås. Ikke nødvendig her, da han ikke er låst.

Vigtigt: alle tre bruger hans **privat-mail** (`private_email`), så det er **sebastianbangsbopetersen@gmail.com** han skal logge ind med — ikke arbejdsmailen.

## Forslag til varig rettelse (kræver din godkendelse)

Genaktivér arbejdsmail-opslaget i login-flowet, så både `svb@copenhagensales.dk` og privat-mailen virker:

- `src/pages/Auth.tsx`: genaktivér `get_auth_email_by_work_email`-opslaget (linje 491-519) med kort timeout og fallback til den indtastede mail, så login ikke bliver langsommere hvis opslaget fejler.
- Konto-lås-tjekket (`check-account-locked`) i samme blok holdes fortsat slået fra, medmindre du vil have det med igen.
- Zone: rød (auth). Ingen DB-ændring, ingen RLS-ændring.

Sig til hvis jeg skal lave den rettelse — ellers klarer du det med "Sæt ny kode" ovenfor.
