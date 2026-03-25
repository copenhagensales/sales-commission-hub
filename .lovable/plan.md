

# Cohort-forecast: Weekend-fix + Ramp-recalibrering — IMPLEMENTERET

## Ændringer udført

### 1. Weekend/helligdags-fix (`src/lib/calculations/forecast.ts`)
- `dailyHours` beregnes nu som `weeklyHours / 5` (hverdage) i stedet for `/7`
- Simuleringen skipper weekender (lør+søn) og helligdage
- `activeDays` i resultatet viser nu kun faktiske arbejdsdage

### 2. Holidays videregives (`src/hooks/useClientForecast.ts`)
- `holidayDates` (Set<string>) sendes nu med i `CohortForecastInput`

### 3. Type-opdatering (`src/types/forecast.ts`)
- `holidays?: Set<string>` tilføjet til `CohortForecastInput`

### 4. Ramp-profil recalibreret (database)
Eesy TM ramp-profil opdateret fra relative-til-sig-selv til relative-til-etableret-SPH:
- Uge 1: 65% → **20%**
- Uge 2: 95% → **30%**
- Uge 3-4: 100% → **31%**
- Dag 31-60: 100% → **31%**
- Steady state: 100% → **31%**

## Forventet effekt
Cohort-forecast for 15 Eesy TM-sælgere bør falde fra ~876 til ~80-115 salg.
