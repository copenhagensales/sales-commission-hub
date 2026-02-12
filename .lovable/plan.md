
## Opdater DB-grafen til at vise NETTO fra Samlet Oversigt

### Problem
Grafen "DB pr. dag" beregner sit eget simple DB-tal (omsaetning minus provision * 1,125 = ~2,5M kr), men Samlet Oversigt viser et helt andet tal (Team DB: 771.587 kr, NETTO: 347.783 kr) fordi den medregner annulleringer, sygeloen, lokationsomkostninger, assistent-/lederallokering, stab-udgifter og stabsloenninger.

### Loesning
Grafen skal modtage de allerede beregnede tal fra ClientDBTab som props i stedet for at hente og beregne sine egne.

### Trin

**1. Opdater ClientDBDailyChart til at acceptere props**
- Tilfoej props for `nettoTotal`, `teamDB`, `totalRevenue`, `stabExpenses`, og `staffSalaries`
- Fjern den interne `useSalesAggregatesExtended` hook (grafen henter ikke laengere selv data)
- Behold den eksisterende daglige bar-data fra parent, eller modtag `byDate` data som prop
- Vis NETTO-totalet i headeren i stedet for det simple DB-tal
- Fordel overhead (stab + stabsloenninger) jaevnt over dage med salg, saa daglige soejler viser daglig NETTO

**2. Opdater ClientDBTab til at videregive data**
- Send `totals` og `aggregates.byDate` ned til `ClientDBDailyChart`
- Grafen bruger herefter praecis de samme tal som Samlet Oversigt

### Teknisk detalje

Daglige soejler beregnes saaledes:
```text
Per dag:
  dagDB = revenue - commission * 1.125 (som nu)
  dailyOverhead = totalOverhead / antalDageMedSalg
  dagNetto = dagDB - dailyOverhead
```

Header viser:
```text
NETTO: [totals.netEarnings] kr  |  Team DB: [totals.finalDB] kr
```

Dette sikrer at totalerne i grafen matcher praecis med Samlet Oversigt, og de daglige soejler giver et retvisende billede af den daglige netto-indtjening.
