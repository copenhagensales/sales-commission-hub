# Bulk Salg (Leder): dublettjek fanger kun de første 1.000 salg

## Rod-årsag (verificeret)
- `supabase/functions/manual-sales/index.ts:263-268` henter eksisterende salg med `.select(...).limit(20000)` i ét kald. PostgREST skærer svaret ved max-rows (1.000 rækker), så listen af kendte numre/emne-id'er bliver ufuldstændig.
- Databasen har i dag 1.405 manuelle Lederne-salg (1.405 unikke telefonnumre, 1.357 med emne-id). Kun de 1.000 første kom med i dublet-sættet — differencen (405) svarer til de 376 "klar" plus rækker der falder i andre fejl.
- Derfor: samme fil giver "376 salg klar" i stedet for 0.

## Ændringer

### `supabase/functions/manual-sales/index.ts` (kun `bulk_import`)
1. Hent eksisterende salg pagineret med `.range(offset, offset+999)` i loop (indtil færre end 1.000 returneres, hard stop fx 100.000 rækker), i stedet for ét kald med `limit`.
2. Rækkefølge på dublet-tjek: tjek telefonnummer FØRST, derefter emne-id. Så vises "Dublet: mobilnummeret er allerede registreret" som årsag på rækker der reelt er telefon-dubletter, og "Emne-ID er allerede importeret" kun når nummeret er nyt men emne-id'et er set før (samme fil uploadet med ændret nummer).

Ingen ændring i valideringsregler, navne-match, pricing eller insert-logik. Ingen DB-migration.

## Verifikation
- Kør kontrol (dry-run) på samme fil igen: forventet 0 klar og fejllisten domineret af "Dublet: mobilnummeret er allerede registreret" + de ~20 kendte fejl fra i går.
- Bekræft at antal manuelle Lederne-salg i databasen er uændret (1.405) efter en ny kontrol.
