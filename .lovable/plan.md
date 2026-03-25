

# Ændr EWMA-vindue fra 8 uger til 4 uger

## Ændring

**Fil: `src/hooks/useClientForecast.ts`** (linje 22)

```ts
// Fra:
const EWMA_WEEKS = 8;
// Til:
const EWMA_WEEKS = 4;
```

Det er den eneste ændring. Konstanten bruges allerede konsekvent i hele filen:
- Linje 154: Henter salg fra `subWeeks(now, EWMA_WEEKS)` 
- Linje 443-450: Booking-gennemsnit divideres med `EWMA_WEEKS`
- Linje 460: Antal uge-iterationer i EWMA-loopen

Selve EWMA-beregningen (decay = 0.85 pr. uge) i `forecast.ts` er uændret — den arbejder på det array den får, som nu bare bliver 4 uger langt i stedet for 8.

## Effekt
- SPH reagerer hurtigere på nylige performance-ændringer
- Mindre udvanding fra ældre uger
- Momentum-korrektionen (seneste 2 uger vs. EWMA) bliver mindre dramatisk, da EWMA allerede er tættere på nylige tal

## Opdatér også Forretningslogikker-teksten
Tilføj en note på Logikker-siden eller i kodekommentaren om at vinduet er 4 uger (ikke 8).

