# Hvorfor beskeden vises — og hvad der skal rettes

## Hvad du ser
Beskeden "Login med adgangskode er lukket" kommer fra vagten i `src/hooks/usePasswordLoginBlock.ts` (linje 14-21), som kaldes globalt i `src/App.tsx:87`. Den læser `session.user.app_metadata.provider` og logger brugeren ud, hvis værdien ikke er præcis `azure`.

## Bekræftet i data
Forespørgsel mod `auth.users`: **323 af 323 konti har `provider = 'email'`**. Ingen konto har `azure`/`microsoft` som primær provider endnu.

Konsekvens: vagten rammer alle. Din session var oprettet med adgangskode, så du blev logget ud og fik beskeden. Værre: `app_metadata.provider` er kontoens *første* provider, ikke den metode man loggede ind med nu. Når en eksisterende bruger logger ind via Microsoft og identiteten kobles til den samme konto, står `provider` fortsat som `email` — og vagten vil så smide korrekt Microsoft-login ud igen. Det er en reel risiko for at låse alle ude.

## Forslag til rettelse (kun denne fil)
Ret vagten til at vurdere **den aktuelle session**, ikke kontoens historiske provider:

1. Læs `amr` (authentication method reference) fra access-tokenets payload. Log kun ud, hvis den seneste metode er `password`.
2. Fallback hvis `amr` mangler: log kun ud, hvis brugeren slet ikke har en Microsoft-identitet (`user.identities` uden `azure`/`microsoft`) OG providermetadata er `email`.
3. Fjern udlogning ved `INITIAL_SESSION`, hvor metoden ikke kan afgøres — undgå at smide gyldige sessioner ud ved sideskift/reload.

Server-siden er uændret: reset-endpoints svarer fortsat 410, `disable_signup = true` står, og `useMicrosoftLoginGuard` røres ikke.

## Åbent punkt du skal beslutte
Email/password-provideren er stadig aktiv i Cloud → Users → Auth Settings → Sign In Methods → Email (kan ikke slås fra herfra). Alternativ til den skrøbelige klientvagt: slå provideren fra der, og fjern `usePasswordLoginBlock` helt. Det er den robuste løsning — vælg:

- **A**: Ret vagten som beskrevet ovenfor (beholder klientlaget).
- **B**: Du slår Email-provideren fra i Cloud, og jeg fjerner vagten helt.
- **C**: Begge.

## Teknisk
- Filer i scope: `src/hooks/usePasswordLoginBlock.ts` (rettes), evt. `src/App.tsx` (fjern kald, kun ved B).
- Ingen ændringer i auth-konti, user IDs, roller, RLS, provision eller løn.
- Verifikation efter ændring: log ind via Microsoft og bekræft at session holder; kontrollér at `amr`-læsningen ikke fejler for sessioner uden felt.
