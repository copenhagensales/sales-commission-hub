

## Tilføj "Salg/dag" kolonne og sortér efter den

### Ændring
Tilføj en ny kolonne **"Salg/dag"** i tabellen i `LocationHistoryContent.tsx`. Beregningen er simpel: `totalSales / bookedDaysCount`. Tabellen sorteres som standard efter denne værdi (højeste først) i stedet for DB.

### Fil der ændres

| Fil | Ændring |
|-----|---------|
| `src/pages/vagt-flow/LocationHistoryContent.tsx` | Tilføj `salesPerDay` felt i `AggregatedLocation`, beregn det, tilføj kolonneheader + celle, og sortér efter `salesPerDay` desc. Også i ugeopdeling og subtotaler. |

### Detaljer
- **Beregning**: `salesPerDay = bookedDaysCount > 0 ? totalSales / bookedDaysCount : 0`
- **Format**: Vises med 1 decimal (fx "2,3")
- **Sortering**: `.sort((a, b) => b.salesPerDay - a.salesPerDay)` erstatter den nuværende DB-sortering
- **Ugeopdeling**: Viser også salg/dag pr. uge (`sales / days`)
- **Subtotaler**: Beregner samlet salg/dag for gruppen
- **Placering**: Kolonnen placeres lige efter "Salg" kolonnen

