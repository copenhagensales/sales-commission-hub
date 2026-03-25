

# Problem: Hybrid-blending trækker stadig stærke nye sælgere ned

## Årsag
Formlen `finalSph = (1 - w) * rampedSph + w * empiricalSph` blander **altid** den lave ramp-SPH ind — selv når vi har pålidelige data.

For Jacob Cenni med w ≈ 0.8:
- `rampedSph` = 0.83 × 0.31 = **0.26** (gennemsnit for alle nye)
- `empiricalSph` ≈ **0.72** (hans faktiske performance)
- `finalSph` = 0.2 × 0.26 + 0.8 × 0.72 = **0.63**

De 20% ramp-komponent trækker ham fra 0.72 ned til 0.63 — et tab på ~13%. Over en hel måned med ~140 timer bliver det ~12-13 salg tabt "i modellen", bare fordi gennemsnittet for nye sælgere er lavt.

Ved 130 faktiske salg i indeværende måned ville man forvente ~120-130 næste måned — ikke ~81.

## Fix: Asymmetrisk blending

Når empirisk SPH er **højere** end ramp-SPH og reliability er tilstrækkelig (w > 0.5), bør ramp-komponenten ikke trække ned. Ramp eksisterer for at estimere performance når vi mangler data — ikke for at straffe gode sælgere.

**Ny logik i `forecastNewEmployeeHybrid()`:**

```ts
// Hvis empirisk > ramp OG reliability er høj: brug ren empirisk (med guardrails)
// Hvis empirisk < ramp: behold blending (ramp beskytter mod pessimistisk data)
if (clampedEmpiricalSph >= rampedSph && w >= 0.5) {
  finalSph = clampedEmpiricalSph;  // Trust proven performance
} else {
  finalSph = (1 - w) * rampedSph + w * clampedEmpiricalSph;  // Blend as before
}
```

Effekt for Jacob: `finalSph ≈ 0.72`, forecast ≈ 0.72 × 140 × 0.92 ≈ **93 salg** (+ evt. momentum-boost → ~100-107).

Effekt for svage nye sælgere: uændret — ramp-blending beskytter stadig mod urealistisk lav empiri.

## Ændringer

| Fil | Ændring |
|-----|---------|
| `src/lib/calculations/forecast.ts` | Tilføj asymmetrisk blend-check (~5 linjer i `forecastNewEmployeeHybrid`) |
| `src/lib/calculations/__tests__/forecast-hybrid.test.ts` | Tilføj test for asymmetrisk case |

