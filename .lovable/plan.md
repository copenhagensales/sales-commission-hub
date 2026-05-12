## Problem

Tryg er kun linket til team **United** i `team_clients`. I `MultiSelectFilter.tsx:42-46` skjules "udenfor scope"-options helt — de vises kun hvis allerede valgt:

```ts
const inScope = options.filter((o) => !o.outOfScope);
const outOfScopeSelected = options.filter((o) => o.outOfScope && selected.includes(o.id));
return [...inScope, ...outOfScopeSelected];
```

For team-scopede brugere (`scopeReportsDaily === "team"`) auto-vælges deres team i `DailyReports.tsx:256-258`. Hvis deres team ikke ejer Tryg → Tryg markeres `outOfScope` i `clientOptions` (linje 1119) → filtreres helt væk.

Selv hvis du selv intet team har valgt, sker auto-selection inden du ser dropdown'en.

## Fix

Vis altid alle options i dropdown'en. Out-of-scope vises blot greyed/italic med "(udenfor filter)"-mærket — labellen findes allerede i komponenten, men når aldrig DOM'en pga. filtreringen.

### Ændring (1 fil, grøn zone)

`src/components/reports/MultiSelectFilter.tsx` — opdater `visibleOptions`:

```ts
const visibleOptions = useMemo(() => {
  const inScope = options.filter((o) => !o.outOfScope);
  const outOfScope = options.filter((o) => o.outOfScope);
  return [...inScope, ...outOfScope];
}, [options]);
```

Out-of-scope renderes nederst (sortering bevaret), greyed og kursiv via eksisterende `option.outOfScope`-check på linje 102-105. Klikbare så bruger kan vælge dem.

### Effekt

- Tryg (og andre kunder udenfor brugerens team-scope) er altid synlige og valgbare.
- Samme adfærd for Teams, Medarbejdere, Kampagner — alle bruger samme komponent. Konsistent.
- Ingen ændring i hvilke data der hentes; kun præsentation.

## Zone

Grøn (presentation, ingen forretningslogik, ingen DB).