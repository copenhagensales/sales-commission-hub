

## Fix: Brug medarbejderens vagtplan til beregning af arbejdsdage i SalesGoalTracker

### Problem
`SalesGoalTracker.tsx` beregner arbejdsdage ved at tage alle hverdage (man-fre) og fjerne helligdage og fravær. Den tager **ikke** højde for den individuelle vagtplan. Sandra kan f.eks. have en speciel vagtplan med færre dage eller weekendvagter — men beregneren antager en standard man-fre uge.

### Løsning
Hent vagtdata og følg det etablerede vagthierarki (brugt i `useTeamGoalForecast.ts`):

1. **Individuelle vagter** (`shift` tabellen) — højeste prioritet
2. **Medarbejder-standardvagter** (`employee_standard_shifts` → `team_standard_shift_days`)
3. **Team-standardvagter** (`team_standard_shifts` → `team_standard_shift_days`)
4. **Fallback**: hverdage (man-fre) — kun hvis ingen vagtdata findes

### Ændringer

**1. Ny hook: `src/hooks/useEmployeeWorkingDays.ts`**
- Henter individuelle vagter, medarbejder-standardvagter, team-standardvagter og vagtdage for en given periode
- Henter medarbejderens `team_id` fra `employee_master_data`
- Bygger et sæt af "planlagte arbejdsdage" baseret på vagthierarkiet
- Filtrerer helligdage og godkendt fravær fra
- Returnerer `{ total, passed, remaining, days }` — samme format som nuværende `workingDaysData`

**2. `src/components/my-profile/SalesGoalTracker.tsx`**
- Erstat den inline `workingDaysData` useMemo (linje 212-249) med den nye hook
- Props og resten af komponenten forbliver uændret

### Teknisk detalje
Hookens logik for at afgøre om en dag er en "vagtdag":
```text
for each day in period:
  if absence → skip
  if holiday → skip
  if individual shift exists for that date → count
  else if employee has standard shift → check day_of_week match
  else if team has active standard shift → check day_of_week match  
  else → fallback to weekday (mon-fri)
```

