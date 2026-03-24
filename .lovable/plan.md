

# Fix: "Skipped" natpause-runs trækker succes-raten ned og udløser falske alarmer

## Problem
Alle integrationer viser "Kritisk" efter kl. 21 dansk tid, selvom der ingen fejl er. Årsag: sync-runs med `status = "skipped"` (natpause) tælles med i succes-rate beregningen men **ikke** som succesfulde — de trækker raten ned til 40-67%.

Linje 163 i `SystemStability.tsx`:
```ts
const meaningfulRuns = runs1h.filter((r: any) => r.status !== "skipped_locked");
```
Filtrerer kun `skipped_locked` fra, men ikke `skipped`.

## Løsning

### 1. Ekskludér "skipped" fra succes-rate beregningen
**Fil: `src/pages/SystemStability.tsx`** (linje 163)

```ts
// Fra:
const meaningfulRuns = runs1h.filter((r: any) => r.status !== "skipped_locked");
// Til:
const meaningfulRuns = runs1h.filter((r: any) => r.status !== "skipped_locked" && r.status !== "skipped");
```

Det er den eneste ændring. "Skipped" runs er neutrale (ligesom `skipped_locked`) og skal ikke påvirke succes-raten.

### 2. Opdatér `useStabilityAlerts.ts` lastRuns consecutive-error check
**Fil: `src/hooks/useStabilityAlerts.ts`** (linje ~130)

Den eksisterende consecutive-error tæller bryder også på "skipped" — en `skipped` run er ikke en fejl men bryder heller ikke kæden:
```ts
// Fra:
for (const run of lastRuns) {
  if (run.status === "error") consecutiveErrors++;
  else break;
}
// Til:
for (const run of lastRuns) {
  if (run.status === "skipped" || run.status === "skipped_locked") continue;
  if (run.status === "error") consecutiveErrors++;
  else break;
}
```

## Effekt
- Natpausen viser korrekt "info"-level badges (allerede implementeret i `useStabilityAlerts`)
- Succes-raten forbliver baseret på **faktiske** sync-forsøg
- Ingen falske "Kritisk" alarmer udenfor arbejdstid

