

# Fjern kunstige churn-caps — brug faktiske rater

## Problem
Linje 613-615 i `useClientForecast.ts` beregner den faktiske månedlige churn-rate korrekt, men capper den derefter med `Math.min`:
```ts
bucket0_60: Math.min(actual_rate, 0.25),   // max 25%
bucket61_180: Math.min(actual_rate, 0.12), // max 12%
bucket180plus: Math.min(actual_rate, 0.05) // max 5%
```

Caps'ene blev sat som "rimelige defaults" men maskerer virkeligheden. Hvis et team faktisk mister 35% af nye ansatte pr. måned, skal forecastet afspejle det.

## Ændring

**Fil: `src/hooks/useClientForecast.ts`** (linje 611-615)

Fjern `Math.min`-wrapperen, men behold en øvre grænse på 1.0 (100%) for at undgå matematisk nonsens ved meget små stikprøver:

```ts
const rates: TenureBucketRates = {
  bucket0_60: Math.min(exits.bucket0_60 / (Math.max(starters.entered0_60, 1) * monthsObserved), 1.0),
  bucket61_180: Math.min(exits.bucket61_180 / (Math.max(starters.entered61_180, 1) * monthsObserved), 1.0),
  bucket180plus: Math.min(exits.bucket180plus / (Math.max(starters.entered180plus, 1) * monthsObserved), 1.0),
};
```

**Fil: `src/pages/Logikker.tsx`** — opdatér teksten om churn-rater til at sige "beregnet fra faktiske afgange" i stedet for "capped ved X%".

## Effekt
Forecastet afspejler nu den faktiske churn-rate pr. team og anciennitetsbucket. Teams med høj tidlig churn vil se et lavere forecast (mere realistisk), og teams med lav churn vil ikke blive kunstigt begrænset.

## Berørte filer
- `src/hooks/useClientForecast.ts` (2 linjer)
- `src/pages/Logikker.tsx` (tekst-opdatering)

