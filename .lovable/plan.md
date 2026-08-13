# Romeo kan ikke se "Tast selv salg"

## Årsag (verificeret)
Menupunktet vises kun hvis `useIsUnitedMember` finder medarbejderen — og den slår **kun op på e-mail**:

`src/hooks/useIsUnitedMember.ts:25-32` matcher login-mailen mod `private_email`/`work_email` og returnerer `false`, hvis intet findes.

Data:
- Romeo logger ind som **romeo.malcom@icloud.com** (auth-bruger, senest logget ind i dag).
- Hans medarbejderkort har `private_email = romeo.malcolm@icloud.com` (ekstra "l"), ingen arbejdsmail.
- Team-tilknytning er i orden: Eesy TM (`0cb1b854-…`), som er på listen over teams med adgang.

Stavefejlen i mailen betyder, at e-mail-opslaget fejler, selvom teamet er rigtigt.

## Løsning (kun data-rettelse)
Sæt `private_email` på Romeos medarbejderkort til `romeo.malcom@icloud.com`, så det matcher hans faktiske login. Så virker menupunktet, når han genindlæser siden.

Ingen kodeændringer, ingen ændring i `useIsUnitedMember`, ingen oprydning af den ubrugte dublet-auth-bruger.

## Teknisk
- Én UPDATE på ét felt (`private_email`) på én række i `employee_master_data` (rød zone: persondata — derfor kun denne ene celle).
- Ingen ændring i RLS, edge functions eller frontend-kode.
