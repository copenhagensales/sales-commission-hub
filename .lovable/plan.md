

# Ret overlap-tærskel for 3-minutters integrationer

## Problem
Overlap-detektoren bruger en fast tærskel paa `< 2 minutter` for alle integrationer. Med 3-minutters frekvens er den maksimalt mulige stagger kun 1 minut (offsets 0, 1, 2). Derfor viser tidslinjen altid "4 overlaps" for Enreach-integrationerne, selvom de er optimalt staggered.

## Loesning
Goer overlap-taersklen dynamisk baseret paa den laveste frekvens blandt de sammenlignede jobs. Hvis to jobs begge koerer hvert 3. minut, er den bedst mulige afstand 1 minut -- saa taersklen skal vaere 1, ikke 2.

## Aendringer

### `src/utils/cronOverlapDetector.ts`
I `detectOverlaps`-funktionen: naar to jobs sammenlignes, beregn den effektive taeerskel som `Math.min(thresholdMinutes, minFrequency / jobCount)` for jobs paa samme provider. Alternativt (simplere): sænk bare taersklen til 1 for job-par hvor begge har frekvens <= 3 minutter.

Konkret aendring i loopet (linje 81-117):
- Estimer frekvens for jobA og jobB via `estimateFrequencyFromCron`
- Hvis begge har frekvens <= 3, brug taeerskel = 1 i stedet for den globale taeerskel
- Ellers behold den eksisterende taeerskel

### `src/components/system-stability/TimelineOverlap.tsx`
Opdater legend-teksten fra "Overlap (<2 min)" til "Overlap" (uden hardcodet taeerskel, da den nu er dynamisk).

### Ingen backend-aendringer
Alt er rent frontend-logik.

