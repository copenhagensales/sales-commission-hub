# Ny fane: "Mapping"

Tilføj en fjerde fane "Mapping" til højre for "Claims/Reimport" på Eesy FM afvigelser (Leder). Siden er tom for nu.

## Ændringer

Fil: `src/pages/vagt-flow/EesyFmDeviations.tsx`

- Tilføj `{ value: "mapping", label: "Mapping" }` som sidste element i `TABS`.
- Tilføj `<TabsContent value="mapping">` efter blokken for `raw` med et tomt kort ("Indhold tilføjes senere").

Ingen andre filer eller databaseændringer.
