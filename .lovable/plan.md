# Linjeskift i Tryg-annulleringsmailen

## Årsag (bekræftet)

`supabase/functions/send-tryg-cancellation/index.ts:127-129` sender beskeden som ét `<div>` med `white-space:pre-wrap`. Linjeskiftene findes stadig som `\n` i HTML'en, men Outlook fjerner/ignorerer `white-space:pre-wrap`, så al tekst lægges på én linje — præcis som på skærmbilledet.

## Løsning

Konvertér linjeskiftene til rigtig HTML i stedet for at stole på CSS:

1. Escape teksten som i dag.
2. Erstat `\r\n` og `\n` med `<br>`.
3. Behold `white-space:pre-wrap` som ekstra sikkerhed (skader ikke i klienter der understøtter det).

Ændring kun i `supabase/functions/send-tryg-cancellation/index.ts` (HTML-opbygningen). Ingen ændringer i skabelon, UI, adgang, salgsdata eller pricing/løn.

## Verifikation

Efter deploy: send en testmail med flerlinjet skabelon og bekræft at linjeskiftene vises i Outlook.
