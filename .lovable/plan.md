
# Plan: Vis sygefravær/ferie på TV-skærm under "Salg per opgave"

## Oversigt
Tilføjer absence-data (syg/ferie/no-show) per klient til TV-skærmen, så de små indikatorer under hver opgave-kort også vises i TV mode.

## Nuværende Situation
- **Normal visning**: Viser syge/ferie-indikatorer under hvert klient-kort (🤒 12% (2), 🌴 8% (1))
- **TV mode**: Disse indikatorer er skjult fordi:
  1. Edge function returnerer ikke absence-data per klient
  2. Frontend skipper visningen i TV mode (`!tvMode && absenceData`)

## Løsning

### 1. Edge Function: Tilføj absence per klient
Udvid `tv-dashboard-data/index.ts` til at returnere absence-data grupperet per klient:

```typescript
// I response-objektet (linje ~453):
const response = {
  // ... eksisterende felter ...
  absenceByClient: {
    sickByClient: { "Tryg": 2, "ASE": 1 },
    vacationByClient: { "Tryg": 1 },
    noShowByClient: { "ASE": 1 },
    employeeCountByClient: { "Tryg": 25, "ASE": 18 }
  }
};
```

### 2. Frontend: Brug data i TV mode
Opdater `CphSalesDashboard.tsx` til at vise absence-data i TV mode:

```typescript
// Linje ~1244: Fjern !tvMode betingelsen
{absenceData && (
  // ... eksisterende kode ...
)}

// Brug tvData.absenceByClient hvis i TV mode
const displayAbsenceData = tvMode && tvData?.absenceByClient 
  ? tvData.absenceByClient 
  : absenceData;
```

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `supabase/functions/tv-dashboard-data/index.ts` | Tilføj absence-beregning per klient og inkluder i response |
| `src/pages/dashboards/CphSalesDashboard.tsx` | Fjern `!tvMode` check og brug TV-data når tilgængeligt |

## Tekniske Detaljer

### Edge Function Logik
Beregningen genbruger eksisterende data:
1. Hent `absence_request_v2` for i dag
2. Map employee → team via `team_members`
3. Map team → client via `team_clients`
4. Aggregér counts per klient

### UI Ændring
Minimal ændring - kun fjern betingelsen der skjuler data i TV mode og brug de rigtige data.

## Forventet Resultat
- TV-skærmen viser nu syge/ferie-indikatorer under hver opgave-kort
- Samme visuelle format som normal visning
- Data opdateres sammen med resten af TV dashboard (hvert minut)
