

## Ændr DB% til ROI% (Return on Investment)

### Ændring
Erstat den nuværende DB%-kolonne (DB / Omsætning) med **ROI%** beregnet som:

`ROI% = DB / (Lokationsomk. + Hotel + Diæt) × 100`

Dette viser hvor meget I tjener pr. krone investeret i lokationen — en langt mere brugbar metrik til at vurdere lokationskvalitet.

### Fil der ændres

| Fil | Ændring |
|-----|---------|
| `src/pages/vagt-flow/LocationHistoryContent.tsx` | Omdøb `dbPct` til `roi` overalt. Beregn som `db / (locationCost + hotelCost + dietCost) * 100`. Opdater kolonneheader fra "DB%" til "ROI%". Gælder hovedtabel, ugeopdeling og subtotaler. KPI-kortet opdateres også. |

### Eksempel
- Lokation med DB = 5.000 kr, lokationsomk. 2.000 kr, hotel 1.000 kr, diæt 500 kr → ROI = 5.000 / 3.500 × 100 = **143%** (godt)
- Lokation med DB = -1.000 kr, omkostninger 4.000 kr → ROI = **-25%** (dårligt)

