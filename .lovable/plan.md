

# Tilføj medarbejder-filter til Dubletter-fanen

## Hvad ændres

En ny dropdown "Vælg medarbejder" tilføjes i filter-rækken. Dropdown'en viser **kun medarbejdere der optræder i dublet-grupper**, så man ikke kan vælge nogen uden resultater.

## Teknisk tilgang (1 fil: `DuplicatesTab.tsx`)

1. **Ny state**: `selectedAgent` (string, default `""` = alle)

2. **Beregn medarbejderliste fra `duplicateGroups`**: En `useMemo` der scanner alle dublet-grupper og samler unikke `agent_name`-værdier. Kun navne der faktisk optræder i dubletter vises i dropdown'en.

3. **Filtrer visningen**: De viste `duplicateGroups` filtreres med endnu en `useMemo` - hvis en medarbejder er valgt, vises kun grupper hvor mindst ét salg har den valgte `agent_name`.

4. **UI**: Grid ændres fra `md:grid-cols-3` til `md:grid-cols-4` for at rumme den nye dropdown. Dropdown'en viser "Alle medarbejdere" som default plus de dynamiske navne, sorteret alfabetisk.

5. **Reset**: Når kunde eller datofiltre ændres, nulstilles `selectedAgent` automatisk (da medarbejderlisten kan ændre sig).

## Ændringer

- Tilføj `selectedAgent` state
- Tilføj `agentsWithDuplicates` useMemo (udled fra `duplicateGroups`)
- Tilføj `filteredGroups` useMemo (filter `duplicateGroups` baseret på `selectedAgent`)
- Opdater grid layout til 4 kolonner
- Tilføj Select-komponent for medarbejder
- Brug `filteredGroups` i stedet for `duplicateGroups` i rendering og summary-beregning
- Nulstil `selectedAgent` når `selectedClientId`, `dateFrom` eller `dateTo` ændres

