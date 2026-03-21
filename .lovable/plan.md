

# Vis faktiske + forventede salg per medarbejder i breakdown

## Problem
For indeværende måned viser breakdown-tabellen kun forecast for resterende dage (fx Hans = 39), men hans faktiske salg (102) er gemt i totalen. Det er forvirrende — man tror Hans kun laver 39 salg hele måneden.

## Løsning
Tilføj en "Faktiske salg" kolonne i breakdown-tabellen for indeværende måned, plus en "Total" kolonne.

### Ændringer

**`src/hooks/useClientForecast.ts`**
- For `period === "current"`: beregn faktiske salg **per medarbejder** (ikke kun samlet total)
- Tilføj `actualSales` til hvert `EmployeeForecastResult` objekt via en ny map

**`src/types/forecast.ts`**
- Tilføj `actualSales?: number` til `EmployeeForecastResult`

**`src/components/forecast/ForecastBreakdownTable.tsx`**
- For indeværende måned: vis kolonnerne "Faktiske salg", "Forventet rest", "Total"
- Total = actualSales + forecastSales

### Datahentning
Faktiske salg per medarbejder hentes allerede — vi skal bare gruppere `actualSalesData` per agent_email og mappe tilbage til employee via `employee_agent_mapping`.

