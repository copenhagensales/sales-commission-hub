# Deltid med i tællingen på medarbejder-oversigten

## Hvad ændres

KPI-kortet "Aktive medarbejdere" på Medarbejdere → Alle medarbejdere viser i dag fx `73` med underteksten `+19 starter senere`. Deltidsansatte tælles allerede med i de 73 (de er aktive medarbejdere), men det fremgår ikke hvor mange af dem der er deltid.

Ny visning:

```text
Aktive medarbejdere
73
+19 starter senere · 1 deltid
```

- Deltid tælles ud fra `working_hours_model = 'deltid'` på stamkortet — samme kilde som deltid-tagget i listen.
- Kun aktive medarbejdere der er startet tælles i deltidstallet, så det matcher de 73. Fremtidige startere på deltid tælles ikke her.
- Er der 0 deltid, skjules den del af underteksten, så kortet ikke bliver støjende.

## Teknisk

- `src/pages/EmployeeMasterData.tsx`: beregn `partTimeCount` (aktive, startet, `working_hours_model === 'deltid'`) i samme blok som `activeCount`/`notStartedYetCount`, og send den videre til KPI-kortene.
- `src/components/employees/EmployeeKpiCards.tsx`: ny valgfri prop `partTimeCount`, sammensæt underteksten af de dele der har værdi (`+X starter senere`, `Y deltid`) adskilt med `·`.

Ingen ændringer i data, løn eller rettigheder — kun visning.
