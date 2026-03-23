

# Fix: Kundetarget forsvinder pga. tidszoneforskydning

## Problem
`Forecast.tsx` bruger `new Date(...).toISOString().slice(0, 10)` til at beregne `periodStart`. I dansk tidszone (UTC+1/+2) forskyder `toISOString()` datoen en dag tilbage:
- "Denne måned" (marts): `new Date(2026, 2, 1)` → midnat lokal → `2026-02-28T23:00:00Z` → **`2026-02-28`** (forkert!)
- "Næste måned" (april): `new Date(2026, 3, 1)` → **`2026-03-31`** (forkert!)

Resultatet: upsert gemmer med forkert dato, og næste gang den læser, matcher den ikke de korrekte rækker (`2026-03-01`, `2026-04-01`). Derfor "forsvinder" targettet.

Database har nu duplikerede rækker med forkerte datoer:
- `2026-02-28` (1250) ← forkert, nyligt gemt
- `2026-03-31` (1500) ← forkert, nyligt gemt
- `2026-03-01` (1530) ← korrekt, ældre
- `2026-02-01` (1340) ← korrekt, ældre

## Løsning

| Ændring | Hvad |
|---------|------|
| `src/pages/Forecast.tsx` | Erstat `toISOString().slice(0,10)` med manuelt formateret dato: `` `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` `` — bruger lokal tid, ingen UTC-forskydning. |
| **Database oprydning** | Slet de to forkerte rækker (`2026-02-28` og `2026-03-31`) eller migrer dem til korrekte datoer. |

## Teknisk detalje
Linje ~141-147 i Forecast.tsx ændres fra:
```typescript
const target = period === "current"
  ? new Date(now.getFullYear(), now.getMonth(), 1)
  : new Date(now.getFullYear(), now.getMonth() + 1, 1);
return target.toISOString().slice(0, 10);
```
til:
```typescript
const m = period === "current" ? now.getMonth() : now.getMonth() + 1;
const y = now.getFullYear() + Math.floor(m / 12);
const month = (m % 12) + 1;
return `${y}-${String(month).padStart(2, '0')}-01`;
```

Derefter oprydning: slet de to forkerte rækker og opdater med korrekte værdier.

