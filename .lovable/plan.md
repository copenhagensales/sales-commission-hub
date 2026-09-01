# TDC Månedsmål: mindre overskrift + dagsbokse under fælles-linjen

## Hvad ændres

1. **Overskrift mindre**
   "TDC Månedsmål" reduceres et trin i størrelse (og undertitlen lidt ned), så der frigives højde til fælles mål-boksen.

2. **Fælles mål-boksen bliver større**
   Mere padding/højde og en tykkere progress-linje, så den fylder den plads overskriften frigav.

3. **Dagsbokse under linjen**
   Under fælles-linjen tilføjes én lille boks pr. dag i måneden (28–31 alt efter måned). Hver boks viser:
   - dagsnummeret (lille, øverst)
   - antal salg den dag (vægtet som resten af boardet: fiber HAP/VOK tæller 0,5)

   Visuelt:
   - dage uden salg: dæmpet
   - dage med salg: fremhævet
   - dagens dato: tydelig ramme
   - weekender: dæmpet baggrund (tæller stadig salg med hvis der er nogen)

   Boksene ligger på én række på tværs af boardets bredde, så man kan læse dagsfordelingen direkte under linjen.

```text
[███████████░░░░░░░░░░░░░░░░░]  ← fælles linje
 1  2  3  4  5  6  7  8 ... 30
 3  5  0  2  4  -  -  6      0
```

## Teknisk

- `supabase/functions/tv-dashboard-data/index.ts` (`handleTdcMonthlyGoal`): tilføj `sale_datetime` til select og send `saleDate` (YYYY-MM-DD, dansk tid) med på hver linje i `items`. Ingen ændring i filtrering, status-logik eller sælgerliste.
- `src/hooks/useTdcMonthlyGoal.ts`: udvid payload-typen med `saleDate`, og returnér `days: { date: string; day: number; count: number; isWeekend: boolean; isToday: boolean }[]` for alle dage i måneden. Vægtning genbruger den eksisterende `FIBER_BOARD_POINTS`-logik, så `teamCount` og sælgertal er uændrede.
- `src/pages/dashboards/TdcMonthlyGoalBoard.tsx`: mindre overskrift, større fælles-boks, ny dagsboks-række under progress-linjen.

Ingen ændringer i mål, provision, lønlogik eller pricing.
