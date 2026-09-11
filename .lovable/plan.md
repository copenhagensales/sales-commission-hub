# William Seans månedsmål på Relatel Månedsmål

## Hvad der skal ske

William Sean Maare Bai står i dag uden eget månedsmål på boardet "Relatel Månedsmål". Han skal have et mål på 50 salg for september 2026, så hans linje viser opnåelse i procent på samme måde som de øvrige sælgere.

## Sådan gøres det

Målene for boardet ligger som en fast liste pr. måned med sælgerens navn og måltal. Der tilføjes én linje for september 2026:

- William Sean Maare Bai: 50

Navnet er bekræftet stavet præcis sådan i medarbejderstamdata (aktiv medarbejder), så hans salg kobles korrekt til målet.

## Det jeg ikke ændrer

Det fælles teammål står i dag på 650. Når William får 50 individuelle mål, summerer de individuelle mål til 700. Jeg lader teammålet stå på 650, da du ikke har bedt om at ændre det — sig til hvis det skal hæves.

## Teknisk

- Fil: `src/config/relatelMonthlyGoals.ts`, blokken `"2026-09"` → `sellers`.
- Ingen databaseændringer, ingen ændringer i beregning eller i andre boards. `getRelatelSellerGoal` normaliserer navne (trim/mellemrum/store og små bogstaver), så opslaget er robust.
- Verifikation: typetjek plus visuel kontrol af boardet, hvor Williams linje skal vise sit antal salg ud af 50 med korrekt procent.
