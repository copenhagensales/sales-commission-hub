# Ny fane: "Slettede salg"

Tilføj en fjerde fane til højre for "Claims/Reimport" på siden Eesy FM afvigelser (Leder). Ingen funktionalitet endnu — kun fanen og en tom placeholder.

## Ændringer

Fil: `src/pages/vagt-flow/EesyFmDeviations.tsx`

- Tilføj `{ value: "deleted", label: "Slettede salg" }` som sidste element i `TABS` (linje 74-78), så knappen kommer længst til højre i `TabsList`.
- Tilføj `<TabsContent value="deleted">` efter blokken for `raw`, med et simpelt kort og teksten "Indhold tilføjes senere".

Ingen andre filer, hooks eller databaseændringer.
