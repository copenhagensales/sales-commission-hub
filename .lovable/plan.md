

## Forbedring af `estimateFrequencyFromCron` — robusthed og tests

### Analyse af nuværende problemer

**1. Wrap-around ignoreres:**
For `5,55 * * * *` beregnes kun gap `55-5 = 50`, gennemsnit = 50. Men den reelle frekvens er 10 min (gap 50 + wrap-around gap 10, delt i 2 = 30... stadig forkert med gennemsnit). Det rigtige svar er **minimum gap inkl. wrap = 10**.

**2. Gennemsnit er misvisende for ujævne schedules:**
`1,2,58 * * * *` giver gaps `[1, 56]`, gennemsnit = 28.5 ≈ 29. Men den tætteste kollision er 1 minut — det er det relevante for overlap-detektion.

**3. Kontekst: funktionen bruges i `detectOverlaps` til at vælge threshold.**
Her er **minimum gap** den korrekte strategi — vi vil vide "hvor tæt kan to firings komme?" for at justere overlap-sensitivitet.

### Valgt algoritme: **Minimum cirkulær gap**

- Beregn alle consecutive gaps inkl. wrap-around (60 - last + first)
- Returnér det **mindste** gap
- Dette giver den mest konservative (og korrekte) frekvensestimering til overlap-detektion

### Ændringer

**Fil: `src/utils/cronOverlapDetector.ts`** — `estimateFrequencyFromCron`

```typescript
/**
 * Estimate the effective frequency (minimum gap between firings)
 * from a cron expression, including wrap-around across the hour boundary.
 *
 * Uses minimum circular gap — the shortest interval between any two
 * consecutive fire-minutes. This is the correct metric for overlap
 * detection: it answers "how close can two firings get?"
 *
 * Edge-case contracts:
 *  - ≤1 minute-entry → 60 (fires at most once per hour)
 *  - ≥60 minute-entries → 1 (fires every minute)
 */
export function estimateFrequencyFromCron(cronExpression: string): number {
  const minutes = parseCronMinutes(cronExpression);
  if (minutes.length <= 1) return 60;
  if (minutes.length >= 60) return 1;

  let minGap = Infinity;
  for (let i = 1; i < minutes.length; i++) {
    minGap = Math.min(minGap, minutes[i] - minutes[i - 1]);
  }
  // Wrap-around gap: from last firing to first firing in next hour
  const wrapGap = 60 - minutes[minutes.length - 1] + minutes[0];
  minGap = Math.min(minGap, wrapGap);

  return minGap;
}
```

**Ny fil: `src/utils/__tests__/cronOverlapDetector.test.ts`** — 10+ test cases

| Test case | Input | Forventet | Forklaring |
|---|---|---|---|
| Regulær step `*/5` | `*/5 * * * *` | 5 | Jævnt fordelt hvert 5. min |
| Regulær step `*/15` | `*/15 * * * *` | 15 | Jævnt hvert 15. min |
| Wrap-around med tætte slots | `5,55 * * * *` | 10 | Wrap: 60-55+5=10, gap: 50 → min=10 |
| Ujævne gaps prioriterer mindste | `1,2,58 * * * *` | 1 | Gaps: 1, 56, wrap 3 → min=1 |
| Enkelt minut returnerer 60 | `30 * * * *` | 60 | Kun 1 firing |
| Hvert minut returnerer 1 | `* * * * *` | 1 | 60 entries |
| Range + liste kombination | `0-5,30 * * * *` | 1 | 0,1,2,3,4,5,30 → min gap=1 |
| Step med offset | `3,18,33,48 * * * *` | 15 | Jævnt 15 min inkl. wrap (60-48+3=15) |
| To tætte med stort wrap | `29,31 * * * *` | 2 | Gap 2, wrap 58 → min=2 |
| Range schedule | `10-15 * * * *` | 1 | Consecutive minutes → min=1 |

### Ingen breaking changes
- Funktionssignaturen er uændret
- Edge-case kontrakterne bevares (≤1 → 60, ≥60 → 1)
- `detectOverlaps` bruger funktionen til threshold — minimum gap er mere korrekt her end gennemsnit

