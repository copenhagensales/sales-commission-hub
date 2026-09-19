# Kampagneoversigt Tryg — tragt-layout i tabel og mail

Tabellen bygges om, så kolonnerne følger tallenes egen logik fra venstre mod højre. Samme layout på rapportsiden og i mandagsmailen.

## Ny kolonnerækkefølge

```text
                        Frasorteret            Kvalificeret
Rapportlinje | Lukkede | Ugyldig | Ukvalificeret | Ja/nej | Ja/nej-andel | Bookede | Hitrate
```

- "Lukkede" står først som indgangstal (597 = 75 + 53 + 469).
- Frasorterede statusser kommer lige efter, så frafaldet ses før resultatet.
- "Ja/nej-andel" viser ja/nej i procent af lukkede (Finansforbundet ca. 26 %, Kanvas ca. 78 %) — den sammenligning gør høje ugyldig-andele synlige.
- "Hitrate" er sidste kolonne som resultat.

## Øvrige ændringer

- Bjælken i hitrate-kolonnen fjernes. Procenttallet står alene i grønt, så tomrummet mellem bjælke og tal forsvinder.
- Gruppeoverskrifter over kolonnerne: "Frasorteret" over Ugyldig/Ukvalificeret og "Kvalificeret" over Ja/nej, Ja/nej-andel og Bookede.
- Alle procenter får én decimal: 46,0 % · 80,0 % · 34,3 %.
- Linjer uden aktivitet (0 lukkede) vises ikke i tabellen. I stedet står en note under tabellen: "2 linjer uden aktivitet: DCU, Hjerteforeningen". Har alle linjer aktivitet, vises ingen note.
- "Tryg i alt"-rækken beholder alle kolonner, inkl. samlet ja/nej-andel og hitrate.

Hvilke statusser der regnes som frasorteret styres fortsat af opsætningen i databasen — nye statusser kommer automatisk med som egen kolonne.

## Teknisk

- `src/pages/reports/WeeklyLeadClosureReport.tsx`: kolonnerækkefølge i tabelhoved/-celler, ekstra hoved-række med grupperede overskrifter (colSpan), ny beregnet `decidedShare`, filtrering af linjer med `closed === 0` plus note, én-decimals procentformatter.
- `supabase/functions/_shared/weekly-lead-closure-mail.ts`: `lineTable()` omskrives til samme rækkefølge og gruppe-header-række; `bar()` fjernes fra brug; lokal procentformatter med én decimal (den delte `pct()` i `quality-mail.ts` røres ikke, da kvalitetsmodulets mails bruger den); nulrækker filtreres med note under tabellen — gælder også tabel 4 for tidligere uger.
- Datainterface (`LineTotals`, stats-tabeller, edge function-beregning) er uændret; det er kun præsentation.
- Efter ændringen deployes `weekly-lead-closure-report`.
