
## Kapacitetspanel: Totalt pædagogisk layout

### Problem
Det nuværende "4/9" format er stadig forvirrende -- man ved ikke hvad man skal gøre med informationen. Brugeren vil vide: "Hvor mange lokationer mangler jeg at booke?"

### Ny visning: Tre klare linjer per dag

For hver kunde vises tre simple rækker med tydelige labels og tal per ugedag:

```text
Eesy FM
                    M    T    O    T    F    L    S
👷 På vagt          18   20   17   18   20   18   18
📍 Booket lok.       4    3    5    4    2    0    0
🎯 Mangler at booke  5    7    4    5    8    9    9
```

**Forklaring af de tre linjer:**
1. **"På vagt"** = totale medarbejdere minus fraværende (= dem der rent faktisk er til rådighed)
2. **"Booket lok."** = antal lokationer der allerede er booket den dag
3. **"Mangler at booke"** = kapacitet minus booket (= hvor mange flere lokationer du KAN og BØR booke)

Farver på "Mangler at booke":
- **Grøn** med fed: der er stadig lokationer at booke
- **Grå**: 0 -- alt er booket, ingen action nødvendig
- **Rød**: negativt tal -- der er overbooket!

### Tekniske ændringer

**Fil: `src/components/vagt-flow/CapacityPanel.tsx`**

1. Fjern det kompakte "Booket / Kap." layout og progress bars
2. Erstat med tre rækker per kunde:
   - Række 1: `Users`-ikon + "På vagt" + tal per dag (`available = total - absent`)
   - Række 2: `MapPin`-ikon + "Booket" + tal per dag (`booked`)
   - Række 3: `Target`-ikon + "Mangler" + tal per dag (`capacity - booked`), farvekodet
3. Behold dag-headers (M, T, O, T, F, L, S) øverst
4. Fjern info-teksten i bunden (de tre linjer er selvforklarende)
5. Behold tooltip med detaljer ved hover på tallene
6. Gør tallene bredere (w-10) så de er nemme at læse
7. Tilføj en lille forklaringstekst under kundenavnet: "1 lokation = 2 medarbejdere"
