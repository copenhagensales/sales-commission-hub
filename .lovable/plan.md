
## Fix: Skjul "Mangler" i weekenden

### Problem
Weekenden viser kapacitet 0 men stadig bookede lokationer (markeder), hvilket giver et negativt "Mangler"-tal i rod. Det er misvisende -- markedsvagter i weekenden er normale, ikke overbookinger.

### Losning
I weekenden: vis bookede lokationer (de er reelle), men vis "Mangler" som **"-"** (bindestreg) i stedet for et negativt tal. Weekenden har ingen standard-kapacitet, sa der er intet at "mangle".

### Tekniske aendringer

**Fil: `src/components/vagt-flow/CapacityPanel.tsx`**

1. I `capacityByClient` beregningen (linje 193-201): Tilfoej `isWeekend` flag til dayData-objektet sa renderingen ved om det er weekend.

2. I "Pa vagt" renderingen (linje ~284): Vis "-" i stedet for 0 i weekenden (der er ingen standard-vagter at taelle).

3. I "Mangler" renderingen (linje ~308): Vis "-" i stedet for det negative tal i weekenden.

4. "Booket lok." forbliver uaendret -- den viser stadig de reelle markedsbookinger i weekenden.

**Resultat:**
```
              M    T    O    T    F    L    S
Pa vagt      18   20   17   18   20    -    -
Booket lok.   4    3    5    4    2    1    1
Mangler       5    7    4    5    8    -    -
```

Weekenden viser bindestreg for "Pa vagt" og "Mangler" (ikke relevant), men viser stadig de faktiske bookinger under "Booket lok." sa man kan se markedsvagterne.
