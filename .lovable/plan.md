

# Vis advarsel for medarbejdere uden agent-mapping

## Problem
Medarbejdere uden `employee_agent_mapping` viser 0 salg og 0 forecast — ikke fordi de performer dårligt, men fordi systemet ikke kan matche deres salg. Det er forvirrende i breakdown-tabellen.

## Løsning
Tilføj et `missingAgentMapping` flag per medarbejder og vis dem separat i breakdown-tabellen med en tydelig "Mangler opsætning"-advarsel.

### Ændringer

**`src/types/forecast.ts`**
- Tilføj `missingAgentMapping?: boolean` til `EmployeeForecastResult`

**`src/hooks/useClientForecast.ts`**
- Når `EmployeePerformance` objekter bygges: sæt `missingAgentMapping = true` hvis medarbejderen ikke har nogen emails i `empEmailMap`
- Propagér flaget videre til `EmployeeForecastResult`

**`src/lib/calculations/forecast.ts`**
- I `forecastEstablishedEmployee`: kopiér `missingAgentMapping` fra input til output

**`src/components/forecast/ForecastBreakdownTable.tsx`**
- Split medarbejdere i to grupper: `mapped` (har agent-mapping) og `unmapped` (mangler)
- Vis `mapped` i hovedtabellen som i dag
- Vis `unmapped` i en separat sektion med gul advarselsbadge: "Mangler opsætning — salgsdata kan ikke tilknyttes"
- Unmapped medarbejdere tæller ikke med i gennemsnits-SPH

| Fil | Ændring |
|-----|---------|
| `src/types/forecast.ts` | Tilføj `missingAgentMapping` felt |
| `src/hooks/useClientForecast.ts` | Sæt flaget baseret på email-mapping |
| `src/lib/calculations/forecast.ts` | Propagér flaget til result |
| `src/components/forecast/ForecastBreakdownTable.tsx` | Vis unmapped medarbejdere separat med advarsel |

