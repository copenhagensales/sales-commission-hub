

# Plan: Fix timezone-bug i sælgerløsninger (historiske perioder viser 0 kr)

## Problem

Alle historiske lønperioder viser 0 kr. fordi `toISOString()` konverterer datoer til UTC, hvilket forskyder datoen med 1 dag i dansk tidszone (CET/CEST = UTC+1/+2).

Eksempel: `new Date(2026, 0, 15)` (15. januar midnat lokal tid) bliver `"2026-01-14T23:00:00Z"` i UTC. `toISOString().split("T")[0]` giver `"2026-01-14"` i stedet for `"2026-01-15"`.

Det betyder:
- `buildPeriodKey()` bygger `"payroll_2026-01-14"` men snapshot-tabellen har `"payroll_2026-01-15"` - ingen match
- `periodStartISO`/`periodEndISO` er ogsaa forskudt, saa diet, sygedage og dagbonus queries henter forkerte perioder
- `isCurrentPayrollPeriod()` sammenligner ogsaa med forkerte ISO-strenge

## Loesning

### Fil: `src/hooks/useSellerSalariesCached.ts`

**1. Tilfoej lokal dato-formattering**

Erstat `toISOString().split("T")[0]` med en hjælpefunktion der bruger lokal tid:

```typescript
function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

**2. Opdater alle steder der bruger `toISOString()`**

- Linje 50-51: `isCurrentPayrollPeriod` sammenligning
- Linje 61: `buildPeriodKey` 
- Linje 69-70: `periodStartISO` og `periodEndISO`

Alle erstattes med `toLocalDateString()`.

## Teknisk detalje

| Foer (UTC) | Efter (lokal) |
|------------|---------------|
| `new Date(2026,0,15).toISOString().split("T")[0]` = `"2026-01-14"` | `toLocalDateString(new Date(2026,0,15))` = `"2026-01-15"` |

## Omfang

- 1 fil aendres, 5 linjer paavirkes
- Ingen database-aendringer
- Loeser at alle historiske perioder viser 0 kr

