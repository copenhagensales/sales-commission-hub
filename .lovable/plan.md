# TDC Månedsmål: Oliver skal tælle med

## Ændring
I `src/config/tdcMonthlyGoals.ts` fjernes ekskluderingen af Oliver Gonsalves Vatting Arentoft
(`80aac0dd-794c-4a68-97ed-374dc6b4cfea`) for `2026-09`, så `excludeEmployeeIds` bliver tom.

Konsekvens: Oliver vises som sælger på boardet med individuelt mål 30 (samme `defaultSeller` som de øvrige)
og hans egne salg tælles i hans række. Det fælles teammål ændres ikke — teamtotalen har altid inkluderet
alle TDC Erhverv-salgslinjer, uafhængigt af ekskluderingslisten.

## Filer
- `src/config/tdcMonthlyGoals.ts` (config, ingen beregningslogik ændres)
