# Udtræk: afsluttede emner uge for uge – Finansforbundet (Tryg)

## Hvad I får
En knap "Hent Finansforbundet-udtræk" i boksen med Tryg-udtræk på ugerapportsiden. Den laver én Excel-fil for hele 2026 med to faner:

1. **Pr. uge og sælger**: uge, sælger, status (alle lukkede statusser) og antal. For ugyldig og ukvalificeret vises årsagen også. Der er en kolonne med andel ugyldig/ukvalificeret pr. sælger pr. uge, og ugyldig/ukvalificeret er markeret med farve.
2. **Pr. emne**: én række pr. afsluttet emne med emne-nr. fra Adversus, kampagne, afslutningsdato, uge, sælger, status og årsag ved ugyldig/ukvalificeret.

Der kommer **ingen kundeoplysninger** med (navn, telefon, adresse, e-mail eller noter). Med emne-nr. kan I selv slå et emne op i Adversus.

## Hvem kan hente det
Kun superadmin, som ved det eksisterende Hjerteforeningen-udtræk. Filen gemmes i det samme private filområde og vises i listen over tidligere udtræk.

## Hvad bliver ikke ændret
Ugerapporten, mandagsmailen, tallene og beregningerne forbliver som i dag. Der kommer ingen nye tabeller, og der gemmes ingen nye data i Stork.

## Teknisk
- Fane 1 læses fra `weekly_lead_closure_stats`, hvor `report_line = 'Finansforbundet'`. Data findes fra uge 2025-12-29 til 2026-10-12, med kolonnerne week_start, agent_reference, status, invalid_reason og lead_count. Sælgernavnet findes på samme måde som i ugerapporten.
- Fane 2 hentes direkte fra Adversus for de 2 kampagner, der er koblet til Finansforbundet i `weekly_lead_report_campaign_map`. Den bruger samme metode og samme årsagsfelt som `weekly-lead-closure-report`. Kun de felter, der er nævnt ovenfor, læses ud. Intet logges eller gemmes i tabeller.
- Ny edge-funktion `finansforbundet-closure-export`, bygget som `hjerteforeningen-leads-export`: superadmin-tjek, ExcelJS og upload til bucket `tryg-report-exports` med et signeret link.
- Frontend: en ny hook `useRunFinansforbundetExport` i `useTrygReportExports.ts` og en knap i `TrygReportExports.tsx`.
- Fane 1 og fane 2 stemmes af pr. uge, før udtrækket meldes færdigt. Afvigelser bliver rapporteret og ikke skjult.
- Ingen migration og ingen ændring af RLS.
