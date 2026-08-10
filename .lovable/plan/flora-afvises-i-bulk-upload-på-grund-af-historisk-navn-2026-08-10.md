# Flora afvises i bulk-upload på grund af historisk navn

## Årsag (verificeret)

Databasen har to medarbejderrækker med samme arbejdsmail:

- Aktiv: `Flora Klug` — `flk@copenhagensales.dk`
- Inaktiv: `Flora Frederikke Mwikali Lauritsen Klug` — `flk@copenhagensales.dk`

Excel-filen indeholder det lange navn. Bulk-importen henter kun aktive medarbejderrækker (`manual-sales/index.ts:280-296`) og foretager derefter et eksakt normaliseret navnematch (`:334-337`). Derfor findes navnet fra filen ikke i opslaget, selv om Flora er aktiv under det forkortede navn.

## Løsning

Udvid kun navneopslaget i `bulk_import`-handleren:

1. Hent aktive medarbejdere som i dag og opbyg den autoritative liste over aktive arbejdsmails.
2. Hent historiske/inaktive navne med samme arbejdsmail.
3. Tillad et historisk navn som alias **kun når mailen også tilhører en aktiv medarbejder**.
4. Match fortsat til den aktive arbejdsmail, så en reelt fratrådt medarbejder ikke kan få registreret salg.
5. Behold den nuværende normalisering af bindestreger og specialtegn.

Dermed matcher både `Flora Klug` og `Flora Frederikke Mwikali Lauritsen Klug`, mens inaktive medarbejdere uden en aktiv række på samme mail fortsat afvises.

## Afgrænsning og kontrol

- Kun `supabase/functions/manual-sales/index.ts` ændres.
- Ingen medarbejderdata eller databasefelter ændres.
- Ingen ændring i enkeltregistrering, løn, rapporter eller andre navneopslag.
- Edge-funktionen deployes og Floras aktuelle række køres som dry-run; den skal gå fra fejl til “klar”.
- En inaktiv medarbejder uden aktiv mail-modpart kontrolleres fortsat afvist.
