# Procent på Ugyldig og Ukvalificeret

## Hvad ændres

De to frasorterings-kolonner (Ugyldig, Ukvalificeret) viser i dag kun et antal. De skal i stedet vise andelen først og antallet i parentes:

```text
Ukvalificeret:  10,0 % (37 stk)
Ugyldig:        60,0 % (75 stk)
```

Andelen regnes af **Lukkede** på samme linje — altså hvor stor en del af de lukkede emner der blev frasorteret. Det er tallet der gør historien tydelig (fx Finansforbundet med 60 % ugyldige i uge 38).

Samme visning på tre steder:

- Kolonnerne pr. rapportlinje på siden
- Rækken "Tryg i alt" (andel af de samlede lukkede)
- Mandagsmailen, med samme format

Format som resten af tabellen: én decimal og dansk komma. Er der ingen lukkede emner på linjen, vises `0 stk` uden procent.

## Hvad ændres ikke

Lukkede, Ja/nej, Ja/nej-andel, Bookede, Hitrate, Svarprocent og Kontaktandel er uændrede. Ingen beregninger, tabeller eller data ændres — kun hvordan de to kolonner skrives ud.

## Teknisk

- `src/pages/reports/WeeklyLeadClosureReport.tsx`: de celler der i dag skriver `row.extras[s.status] ?? 0` og `totals.extras[s.status] ?? 0` bruger en lille hjælper `sharePlusCount(count, whole)` bygget på den eksisterende `hitrate()`-formatering.
- `supabase/functions/_shared/weekly-lead-closure-mail.ts`: samme hjælper i `lineSection`, så mailen matcher siden 1:1.
- Ingen migration, ingen ændring i `weekly_lead_closure_stats`, edge-funktionens beregning eller cron-planen. Edge function deployes, fordi mailskabelonen er delt kode.
