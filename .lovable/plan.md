

# Problem: Guardrails clamper mod forkert reference

## Årsag
Jacob Cenni er sandsynligvis klassificeret som "ny" (≤60 dage). Hybrid-modellen (linje 271-274 i `forecast.ts`) clamper hans empiriske SPH mod `rampedSph`:

```ts
const clampLow = rampedSph * 0.6;
const clampHigh = rampedSph * 1.4;
```

Med de recalibrerede Eesy TM ramp-faktorer er `rampedSph` nu meget lav:
- `baselineSph` ≈ 0.83 (etablerede Eesy TM-sælgere)
- `rampFactor` ≈ 0.31 (steady state for nye)
- `rampedSph` = 0.83 × 0.31 ≈ **0.26**
- `clampHigh` = 0.26 × 1.4 = **0.36**

Jacobs faktiske SPH ≈ 108 salg / ~150 timer ≈ **0.72** — men guardrail capper ham ved 0.36.

Resultat: `finalSph ≈ 0.36 × ~140 timer × 0.92 ≈ 46 salg`. Det matcher præcis.

## Fejlen
Guardrails bør **ikke** clampe mod `rampedSph` (som er kunstigt lav pga. ramp-faktoren). De bør clampe mod `baselineSph` — den fulde etablerede SPH. Formålet med guardrails er at forhindre at nye sælgere forecaster vildt over/under etableret niveau, ikke at tvinge dem ned til ramp-niveau.

## Fix

**Fil: `src/lib/calculations/forecast.ts`** (linje 271-274)

Ændr clamp-reference fra `rampedSph` til `baselineSph`:

```ts
// Før (forkert):
const clampLow = rampedSph * 0.6;
const clampHigh = rampedSph * 1.4;

// Efter (korrekt):
const clampLow = baselineSph * 0.6;
const clampHigh = baselineSph * 1.4;
```

## Effekt
- Jacob med empirisk SPH 0.72: clampes til `min(0.72, 0.83 × 1.4) = 0.72` (ingen clamp, da han er under 1.4× baseline)
- `finalSph` ≈ blending af 0.26 og 0.72 baseret på reliability weight
- Med f.eks. w=0.8: `finalSph ≈ 0.2 × 0.26 + 0.8 × 0.72 ≈ 0.63`
- Forecast ≈ 0.63 × 140 × 0.92 ≈ **81 salg** — langt mere realistisk for en sælger der laver 108 i denne måned

Opdatér også unit tests til at bruge `baselineSph` som clamp-reference.

## Berørte filer
| Fil | Ændring |
|-----|---------|
| `src/lib/calculations/forecast.ts` | 2 linjer: clamp mod `baselineSph` i stedet for `rampedSph` |
| `src/lib/calculations/__tests__/forecast-hybrid.test.ts` | Opdatér guardrail-test |

