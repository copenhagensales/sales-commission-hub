

## Gør kapacitetspanelet lettere at aflæse

### Problem
Den nuværende visning har tre separate rækker (Kapacitet, Booket, Ledige) med løsrevne tal, som er svære at aflæse hurtigt. Man skal selv sammenligne tallene på tværs af rækker for at forstå situationen.

### Ny visning: "Booket / Kapacitet" med progress bar

Erstat de tre rækker med en enkelt, kompakt visning per dag der viser:

```text
Eesy FM (25 medarbejdere)
        M     T     O     T     F     L     S
       4/9   3/9   5/8   4/9   2/9   0/9   0/9
       [====-    ] [===-     ] [======-  ] ...
```

Hvert dagsfelt viser:
- **"4/9"** format (booket/kapacitet) -- klart og entydigt
- En lille progress bar under tallet der visuelt viser fyldningsgraden
- Farve baseret på fyldningsgrad:
  - **Gron**: under 50% booket (masser af plads)
  - **Gul**: 50-80% booket (ved at fylde op)
  - **Rod**: over 80% eller fuldt booket
  - **Mork rod**: overbooket (booket > kapacitet)

### Tooltip
Hover viser stadig detaljer: "Mandag 24. feb -- 9 kapacitet, 4 booket, 5 ledige (7 fravaerende)"

### Tekniske andringer

**Fil: `src/components/vagt-flow/CapacityPanel.tsx`**

1. Fjern de tre separate raekker (Kapacitet, Booket, Ledige) og erstat med en enkelt raekke per kunde
2. Hvert dagsfelt renderes som en kompakt celle med:
   - Tekst: `{booked}/{capacity}` i fed skrift
   - En 4px progress bar nedenunder (`width: (booked/capacity)*100%`)
   - Baggrundsfarve baseret pa fyldningsgrad
3. Behold tooltip med fuld breakdown
4. Behold info-teksten i bunden men opdater til at bruge "X/Y" format
5. Tilf0j `absent` til dayData-objektet sa tooltip kan vise det

### Resultat
- Et hurtigt blik viser "4/9" = 4 ud af 9 mulige lokationer er booket
- Progress baren giver visuelt overblik uden at laese tal
- Farverne signalerer straks om der er plads eller ej
- Meget mere kompakt -- en raekke i stedet for tre

