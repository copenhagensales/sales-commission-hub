# Ens visning af telefonnumre på "Tryg - Ret salg"

## Hvad ændres
Alle telefonnumre på siden vises som 8 cifre uden mellemrum og uden +45/0045 foran (fx `+45 21 69 09 28` og `004520143922` → `21690928` / `20143922`). Gælder alle faner (United-salg, Kanvas-møder, Alle tryg & alka salg).

## Hvad ændres IKKE
- Ingen data i databasen rettes — kun visningen.
- Numre der ikke kan tolkes som danske 8 cifre (fx udenlandske eller for korte) vises uændret, så intet skjules eller forvanskes.
- Søgning virker som i dag (bruger allerede samme normalisering).

## Teknisk
- Flyt `normalizePhone` fra `TrygEditSales.tsx` til en delt hjælper (fx `src/utils/phoneFormat.ts`) med `formatDanishPhone()`: fjern ikke-cifre, fjern 0045 / 45-præfiks ved >8 cifre; returnér 8 cifre, ellers originalværdien.
- Brug den i visningen i `TrygSalesTable.tsx` (linje 167) og i United-tabellen i `TrygEditSales.tsx`.
- Kopiering af numre til skabelonen ("kopiér numre") bruger også det formaterede nummer, så det bliver ens.
- Grøn zone (kun visning).
