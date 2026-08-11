# Sebastians login-fejl — ikke relateret til teamændringen

## Kort svar

Nej. Ændringen jeg lavede var udelukkende dropdown-listen i "Rediger team" (`TeamsTab.tsx`). Den rører ikke login, auth eller rettigheder.

## Hvad jeg kan se i data

- Hans auth-konto findes: e-mail **sebastianbangsbopetersen@gmail.com** (privat-mailen). Kontoen er **ikke låst** (`account_locked = false`, `failed_login_count = 0`), og han er aktiv.
- `login_events` har **nul** rækker for ham — han er aldrig kommet igennem et login.
- Auth-loggen viser flere `400: Invalid login credentials` kl. 13:33–13:34 i dag, samt en admin-opdatering af hans bruger kl. 13:34:32 (kodeord-nulstilling fra Stork).
- Login-siden slår **ikke** arbejdsmail om til auth-mail: opslaget `get_auth_email_by_work_email` er kommenteret ud i `src/pages/Auth.tsx:491-519` ("DISABLED DURING EMERGENCY").

Det betyder: forsøger han at logge ind med **svb@copenhagensales.dk**, findes den mail ikke i auth, og han får "Forkert login — forkert email eller adgangskode". Det er den mest sandsynlige forklaring.

## Hvad du gør nu (ingen kodeændring nødvendig)

1. Bed ham logge ind med **sebastianbangsbopetersen@gmail.com** og det kodeord han fik i invitationen/nulstillingen.
2. Virker det ikke: send en ny kodeord-nulstilling til den samme private mail.

## Forslag til varig rettelse (kræver din godkendelse)

Genaktivér arbejdsmail-opslaget i login-flowet, så både `svb@copenhagensales.dk` og privat-mailen virker:

- `src/pages/Auth.tsx`: genaktivér `get_auth_email_by_work_email`-opslaget (linje 491-519) med kort timeout og fallback til den indtastede mail, så login ikke bliver langsommere hvis opslaget fejler.
- Konto-lås-tjekket (`check-account-locked`) i samme blok holdes fortsat slået fra, medmindre du vil have det med igen.
- Zone: rød (auth). Ingen DB-ændring, ingen RLS-ændring.

Sig til hvis jeg skal lave den rettelse — ellers stopper vi ved punkt 1-2 ovenfor.

## Hvis fejlen er en anden

Hvis hans fejlmeddelelse ikke er "Forkert login" (fx "Server utilgængelig", timeout, eller en adgangsfejl **efter** login), så send ordlyden/skærmbilledet — så peger den et andet sted hen, og jeg undersøger det spor i stedet.
