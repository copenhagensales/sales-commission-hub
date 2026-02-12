

## Fordel kun overhead paa hverdage i NETTO pr. dag grafen

### Problem
Stab-udgifter og stabsloenninger fordeles i dag paa alle dage med salg -- ogsaa weekender. Det giver kunstigt negative soejler i weekender, hvor der kun er lidt omsaetning men stadig faar tildelt en stor del af overhead.

### Loesning
Aendr fordelingslogikken saa overhead kun fordeles paa hverdage (mandag-fredag) med salg. Weekenddage viser kun deres rene DB (omsaetning minus provision inkl. feriepenge) uden overhead-fradrag.

### Teknisk aendring

**Fil: `src/components/salary/ClientDBDailyChart.tsx`**

I `chartData` useMemo (linje ~55-62):

```text
Nuvaerende logik:
  daysWithSales = alle dage med salg > 0
  dailyOverhead = totalOverhead / daysWithSales
  netto = db - dailyOverhead (for alle dage med salg)

Ny logik:
  // Tjek om en dato er hverdag (man-fre)
  isWeekday = parseISO(dateStr).getDay() >= 1 && <= 5

  weekdaysWithSales = dage der baade er hverdage OG har salg > 0
  dailyOverhead = totalOverhead / weekdaysWithSales

  netto = db - dailyOverhead  (kun for hverdage med salg)
  netto = db                  (for weekender -- ingen overhead)
```

Dette sikrer at:
- Weekender viser ren DB uden stab-fradrag
- Hverdage baerer hele overhead-byrden
- Summen af alle daglige soejler stadig matcher NETTO-totalet

