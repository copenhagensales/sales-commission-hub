

## Ret tidszone til dansk tid (Europe/Copenhagen) i reminder edge functions

### Problem
`send-closing-reminder` og `send-weekend-cleanup` bruger `new Date().getDay()` som returnerer UTC-ugedag. Omkring midnat kan dette give forkert dag — f.eks. fredag aften kl. 23:30 dansk tid er lørdag 00:30 UTC, og weekend-cleanup ville ikke blive sendt.

### Ændringer

#### 1. `supabase/functions/send-closing-reminder/index.ts` (linje ~110-112)
Erstat:
```typescript
const now = new Date();
const jsDay = now.getDay();
const weekday = jsDay === 0 ? 7 : jsDay;
```
Med:
```typescript
const now = new Date();
const dkDay = parseInt(
  new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Copenhagen', weekday: 'narrow' })
    .formatToParts(now).find(p => p.type === 'weekday')?.value || '0'
);
// Brug Intl til at hente den korrekte ugedag i dansk tid
const dkDayOfWeek = new Date(
  now.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' })
).getDay();
const weekday = dkDayOfWeek === 0 ? 7 : dkDayOfWeek;
```

Simplificeret til ét kald:
```typescript
const now = new Date();
const dkDayOfWeek = new Date(
  now.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' })
).getDay();
const weekday = dkDayOfWeek === 0 ? 7 : dkDayOfWeek;
```

#### 2. `supabase/functions/send-weekend-cleanup/index.ts` (linje ~105-106)
Erstat:
```typescript
const now = new Date();
const jsDay = now.getDay();
```
Med:
```typescript
const now = new Date();
const jsDay = new Date(
  now.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' })
).getDay();
```

#### 3. Tilføj logging i begge funktioner
Log den beregnede danske dag for debugging:
```typescript
console.log(`Danish weekday: ${weekday} (UTC day: ${now.getUTCDay()})`);
```

### Filer der ændres
1. `supabase/functions/send-closing-reminder/index.ts` — brug dansk tid til ugedag
2. `supabase/functions/send-weekend-cleanup/index.ts` — brug dansk tid til ugedag

### Ikke berørt
- `activate-pulse-survey` — bruger allerede `Intl.DateTimeFormat` med `Europe/Copenhagen`
- `calculate-kpi-values` / `tv-dashboard-data` — opererer på datostrenge, ikke live ugedag-check
- `_shared/date-helpers.ts` — bruges til periodeberegning, ikke live dag-detection

