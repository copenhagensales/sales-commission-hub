

## Fix: Kapacitet skal vises som samlet pulje, ikke per kunde

### Problem
Kapacitetspanelet viser det **samme** antal medarbejdere (f.eks. 25) for **hver** kunde (Eesy FM og Yousee). Det er den samme pulje FM-medarbejdere der deles mellem kunderne, sa det giver et misvisende billede -- det ser ud som om der er dobbelt sa mange folk som der reelt er.

### Losning
Aendr panelet til at vise en **samlet kapacitetsoversigt** i stedet for at duplikere tallene per kunde:

- **En enkelt "Pa vagt" raekke** der viser det samlede antal tilgaengelige FM-medarbejdere per dag
- **En enkelt "Kapacitet" raekke** der viser det samlede antal lokationer teamet kan daekke (tilgaengelige / 2)
- **"Booket lok." per kunde** -- her giver det mening at vise per kunde, da bookinger ER per kunde
- **"Mangler" raekke** der viser samlet kapacitet minus alle bookinger pa tvaers af kunder

### Forventet resultat
```text
Kapacitet uge 9
1 lokation = 2 medarbejdere

              M    T    O    T    F    L    S
Pa vagt      22   22   21   22   20    -    -
Kapacitet    11   11   10   11   10    -    -

Booket lok.
  Eesy FM     5    5    5    5    4    1    1
  Yousee      4    4    4    4    4    1    0
  Total       9    9    9    9    8    2    1

Mangler       2    2    1    2    2    -    -
```

### Tekniske aendringer

**Fil: `src/components/vagt-flow/CapacityPanel.tsx`**

1. Fjern `capacityByClient` loop-strukturen og erstat med en samlet beregning:
   - Beregn `totalAvailable` per dag en gang (samlet for alle FM-medarbejdere)
   - Beregn `totalCapacity = Math.floor(totalAvailable / 2)` per dag
   - Beregn bookinger per kunde per dag (behold eksisterende logik)
   - Beregn `totalBooked` som sum af bookinger pa tvaers af alle kunder
   - Beregn `remaining = totalCapacity - totalBooked`

2. Opdater renderingen:
   - Vis en samlet "Pa vagt" raekke med det reelle antal tilgaengelige medarbejdere
   - Vis en samlet "Kapacitet" raekke (lokationer)
   - Vis "Booket lok." med en underraekke per kunde + en total-raekke
   - Vis en samlet "Mangler" raekke baseret pa total kapacitet minus total booket

3. Tooltips opdateres til at reflektere den samlede beregning

Denne aendring sikrer at kapaciteten afspejler virkeligheden: der er en fast pulje FM-medarbejdere, og den samlede kapacitet skal daekke bookinger pa tvaers af alle kunder.
