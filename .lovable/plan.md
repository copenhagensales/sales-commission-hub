

## Erstat ROI% med DB/dag

### Ændring
Erstat "ROI%" kolonnen med **"DB/dag"** — beregnet som `DB / bookedDaysCount`. Vises i kroner (fx "1.234 kr.") i stedet for procent.

### Fil der ændres

| Fil | Ændring |
|-----|---------|
| `src/pages/vagt-flow/LocationHistoryContent.tsx` | Omdøb `roi` til `dbPerDay` overalt. Beregn som `db / days`. Vis med `formatKr()` i stedet for `formatPct()`. Opdater header fra "ROI%" til "DB/dag". Gælder KPI-kort, hovedtabel, ugeopdeling og subtotaler. |

### Beregning
- **Hovedtabel**: `dbPerDay = totalDays > 0 ? db / totalDays : 0`
- **Ugeopdeling**: `dbPerDay = wb.days > 0 ? db / wb.days : 0`
- **Subtotaler**: `dbPerDay = totalDays > 0 ? totalDB / totalDays : 0`
- **KPI-kort**: `dbPerDay = totalDays > 0 ? totals.totalDB / totalDays : 0`

