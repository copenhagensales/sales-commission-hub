

# Tilføj "Salg uden telefonnr." KPI + total-kontekst

## Problem
"Registrerede salg" viser 1.522, men valideringsresultaterne (verificerede + uverificerede + annulleringer) summerer kun til ~510 — fordi 1.012 salg uden telefonnummer springes over i matchingen. Der mangler en KPI der viser dette gap.

## Ændringer i `src/pages/economic/SalesValidation.tsx`

### 1. Udvid salesStats query til at tælle salg med/uden telefonnummer
Tilføj en ekstra query (eller udvid den eksisterende) der henter antal salg med `customer_phone IS NOT NULL` vs total antal salg. Brug `sales`-tabellen direkte med `count` for begge kategorier.

### 2. Tilføj KPI-kort "Uden telefonnr." (altid synligt)
Mellem "Provision" og de post-validerings KPI'er, tilføj et gult/orange kort der viser antal salg uden telefonnummer. Disse kan ikke auto-valideres.

### 3. Tilføj KPI "Valideret dækning" efter validering
Vis en procentsats: `(verificerede + matchede annulleringer) / totalSales` — så brugeren kan se hvor stor en andel af alle salg der er dækket.

### 4. Opdatér "Registrerede salg" med undertekst
Vis fx `1.522 total` med en lille `text-xs` linje under: `510 med tlf · 1.012 uden`.

### Layout
```
[Registrerede salg]  [Omsætning]  [Provision]  [Uden tlf.nr]
     1.522              304.400kr     114.150kr     1.012
  510 m/tlf                                      Kan ikke valideres

--- efter validering ---
[Verificerede]  [Uverificerede]  [Annulleringer]
```

