# Romeo kan ikke se "Tast selv salg"

## Årsag (verificeret)
Menupunktet vises kun hvis `useIsUnitedMember` finder medarbejderen — og den slår **kun op på e-mail**:

`src/hooks/useIsUnitedMember.ts:25-32` matcher login-mailen mod `private_email`/`work_email` og returnerer `false`, hvis intet findes.

Data:
- Romeo logger ind som **romeo.malcom@icloud.com** (auth-bruger, senest logget ind i dag).
- Hans medarbejderkort har `private_email = romeo.malcolm@icloud.com` (ekstra "l"), ingen arbejdsmail.
- Hans `auth_user_id` peger korrekt på login-brugeren.
- Team-tilknytning er i orden: Eesy TM (`0cb1b854-…`), som er på listen over teams med adgang.

Stavefejlen i mailen betyder, at e-mail-opslaget fejler, selvom teamet er rigtigt. Samme mønster som Lucas/Sebastian tidligere.

Bemærk: der findes også en tredje auth-bruger med romeo.malcolm@icloud.com (aldrig logget ind) — en dublet fra 21/7.

## Løsning
1. **Ret data:** sæt `private_email` på Romeos medarbejderkort til `romeo.malcom@icloud.com`, så det matcher hans faktiske login. Så virker menupunktet med det samme.
2. **Ret årsagen (så det ikke gentager sig):** `useIsUnitedMember` slår først op på `auth_user_id` (den autoritative kobling) og bruger kun e-mail som fallback. `auth_user_id` er allerede korrekt sat, så opslaget bliver robust over for stavefejl i mails.
3. **Oprydning (valgfri, kræver din godkendelse):** den ubrugte dublet-auth-bruger `romeo.malcolm@icloud.com` slettes, så han ikke ved et uheld opretter en tom session der.

## Teknisk
- Fil: `src/hooks/useIsUnitedMember.ts` (gul zone: adgang/visning, ingen løn- eller persondatalogik). Opslagsrækkefølge: `auth_user_id` → e-mail-fallback. Team-listen `MANUAL_SALES_TEAM_IDS` og manager-fallback ændres ikke.
- Data-rettelse via migration/UPDATE på ét felt i `employee_master_data` (rød zone: persondata — derfor kun denne ene celle, og kun efter din godkendelse).
- Ingen ændring i RLS, `manual-sales` edge function eller bulk-adgangen.
