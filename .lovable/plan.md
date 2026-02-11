

## Relativ udgiftsvisning i Samlet Oversigt

### Problem
Naar du vaelger "Denne maaned" den 11. februar, viser "Samlet Oversigt" det fulde manedsbeloeb for stab-udgifter og stabsloenninger. Men omsaetning og DB afspejler kun data til og med den 11. Det giver et misvisende billede — det ser altid ud som underskud i starten af perioden.

### Loesning
Vis den relative (proraterede) udgift som primaer vaerdi og det fulde periodebeloeb i parentes. Eksempel:

```text
- Stab-udgifter          -467.000 kr. (932.000 kr.)
- Stabsloenninger         -28.438 kr. (56.876 kr.)
NETTO                    -38.550 kr.
```

Det betyder: "Vi har brugt 467k ud af 932k for maaneden, og med den DB vi har nu, er netto -38k."

### Hvad aendres

**Fil: `src/components/salary/ClientDBTab.tsx`**

1. Beregn en prorateringsfaktor baseret paa periodemodus:
   - For "month": `dage passeret / dage i maaneden`
   - For "payroll": `dage passeret / dage i loenperiode`
   - For "week", "day", "custom": faktor = 1 (ingen proratering, vis som nu)
2. Beregn `prorated` versioner af `stabExpenses` og `staffSalaries`
3. Send baade `prorated` og `full` vaerdier til summary-kortet
4. Beregn NETTO baseret paa de proraterede vaerdier

**Fil: `src/components/salary/ClientDBSummaryCard.tsx`**

1. Udvid props med valgfrie `fullStabExpenses` og `fullStaffSalaries`
2. Naar `full`-vaerdier er tilgaengelige og forskellige fra de primaere, vis formatet:
   `-{prorateret} ({fuld vaerdi})`
3. NETTO beregnes paa de proraterede tal (som allerede er tilfaeldet)

### Prorateringslogik

```text
periodMode === "month" eller "payroll":
  dagsPasseret = min(idag, periodEnd) - periodStart + 1
  dageTotalt   = periodEnd - periodStart + 1
  faktor       = dagsPasseret / dageTotalt
  prorateretUdgift = fuldUdgift * faktor

Andre modes (dag, uge, custom):
  Ingen proratering — vis som hidtil
```

### Beroerte filer

| Fil | AEndring |
|-----|---------|
| `src/components/salary/ClientDBTab.tsx` | Beregn prorateringsfaktor og send full/prorated vaerdier |
| `src/components/salary/ClientDBSummaryCard.tsx` | Vis prorateret vaerdi med fuld vaerdi i parentes |

