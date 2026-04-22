

## Pilot: Omstillings-tekst altid med + fjern opgrader-tekst i Professionel

### Problem
I Pilot-grenen vises omstillings-teksten kun hvis `hasOmstilling = true`. Brugeren ønsker at hovedteksten altid vises i Pilot-varianten, og at "opgrader"-linjen kun vises ved Standard (ikke Professionel).

### Ændring (kun `src/pages/TdcOpsummering.tsx`, ~linje 230-246)

Omskriv Pilot-grenen i `Omstilling`-blokken så:

1. **Hovedlinjen vises altid** for Pilot (uafhængigt af `hasOmstilling`):
   ```
   "I forhold til jeres omstilling og hvordan den skal virke, så er det noget i aftaler med min kollega der ringer og byder jer velkommen."
   ```

2. **Opgrader-linjen** vises kun når `isStandardOmstilling = true` (Standard valgt på toggle), og fjernes når brugeren skifter til Professionel:
   ```
   "Hvis du får brug for menuvalg i fremtiden, så kan du altid opgradere din omstilling"
   ```

Konkret ny logik for Pilot:
```ts
if (isPilot) {
  lines.push({ text: "I forhold til jeres omstilling..." });
  lines.push({ text: "" });
  if (isStandardOmstilling) {
    lines.push({ text: "Hvis du får brug for menuvalg i fremtiden..." });
    lines.push({ text: "" });
  }
} else if (hasOmstilling) {
  // Standard-grenen forbliver uændret (rød tekst + opgrader-linje ved standardOmstilling)
}
```

Dvs. Pilot-blokken flyttes ud af `if (hasOmstilling)`-betingelsen, mens Standard-grenen beholder sin nuværende `hasOmstilling`-gate.

### Bivirkning
- `isOmstillingMissing`/warning-banner-logikken (linje 88-90) gælder kun når `!kun5gFriSalg`. Pilot er ikke `kun5gFriSalg`, men teksten vises nu altid, så det giver mening også at fjerne `isOmstillingMissing` fra warning-banneret når `isPilot = true` for at undgå falsk advarsel. Ændring i linje 90:
  ```ts
  const showWarningBanner = !kun5gFriSalg && (isNummervalgMissing || isOpstartMissing || isMbbMissing || isTilskudMissing || (!isPilot && isOmstillingMissing));
  ```

### Ikke berørt
- Standard-varianten (rød hardware/kaldsflow-linje + opgrader-linje uændret).
- Kun 5g fri salg.
- Toggle-UI for Pilot (Standard/Professionel switch).
- Øvrige felter (nummervalg, opstart, tilskud, MBB).

### Filer berørt
- `src/pages/TdcOpsummering.tsx`

