## To dele

### 1. Confetti — kun guld

I `src/components/league/HallOfFamePodium.tsx` erstattes farvepaletten i `useEffect` så confetti kun bruger guld/amber-toner (ingen sølv, bronze, lilla, pink):

```ts
const goldSilverBronze = [
  "#fde047", "#facc15", "#eab308", "#ca8a04",
  "#fbbf24", "#f59e0b", "#fde68a", "#fef3c7",
];
```

(Variabelnavnet beholdes for at minimere diff — det er bare farverne der ændres.)

### 2. Sæson 2 startes

Sæson 1 er `completed` (sluttede 3. maj 2026). Der findes ingen Sæson 2. Jeg opretter én via insert med samme rytme som Sæson 1, men med **7 dages kvalifikationsvindue** og ~6 ugers sæson:

| Felt | Værdi |
|---|---|
| `season_number` | 2 |
| `status` | `qualification` |
| `is_active` | `true` |
| `qualification_source_start` / `_end` | 2026-05-04 00:00 → 2026-05-10 21:59:59 (UTC) — 7 dage |
| `qualification_start_at` / `_end_at` | 2026-05-04 00:00 → 2026-05-10 21:59:59 (UTC) |
| `start_date` | 2026-05-11 |
| `end_date` | 2026-06-21 (6 uger) |

Insert er idempotent (kun hvis Sæson 2 ikke findes). Andre sæsoner sættes til `is_active = false` så kun Sæson 2 er aktiv.

Brugeren kan justere alle datoer bagefter via SeasonManagerCard → SeasonSettingsDialog.

### Zone

- HallOfFamePodium: grøn (kun farver).
- Insert i `league_seasons`: gul. Rører ikke Sæson 1's data.

### Filer der ændres

- `src/components/league/HallOfFamePodium.tsx`
- INSERT i `league_seasons` for ny Sæson 2.