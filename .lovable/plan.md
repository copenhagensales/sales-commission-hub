

# Fix: Vagter vises som 00:00-00:00

## Årsag
Individuelle vagter i `shift`-tabellen har `start_time = '00:00:00'` og `end_time = '00:00:00'`. Da individuelle vagter har højeste prioritet i visningen (linje 687-694 i VagtplanFMContent), overrider de standard-vagttiderne fra teamet.

## Løsning
Behandl vagter med `start_time = '00:00:00' AND end_time = '00:00:00'` som "ingen individuel vagt" og fald ned til standard-vagttider i stedet.

## Ændring

### `src/pages/vagt-flow/VagtplanFMContent.tsx` — linje 624
Filtrér 00:00-vagter fra i `dayShifts`:
```typescript
// Fra:
const dayShifts = shiftsByEmployeeAndDate.get(employee.id)?.get(dateStr) || [];

// Til:
const dayShiftsRaw = shiftsByEmployeeAndDate.get(employee.id)?.get(dateStr) || [];
const dayShifts = dayShiftsRaw.filter(s => 
  !(s.start_time?.startsWith('00:00') && s.end_time?.startsWith('00:00'))
);
```

Dermed falder visningen igennem til `workTimes` (standard-vagttider) når individuelle vagter kun er 00:00-00:00.

| Fil | Ændring |
|-----|---------|
| `src/pages/vagt-flow/VagtplanFMContent.tsx` | Linje 624: filtrér 00:00-vagter fra så standard-tider vises |

