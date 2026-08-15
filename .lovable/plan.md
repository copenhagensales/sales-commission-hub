# Fjern fanen "Slettede salg"

Fanen droppes igen — tilbage til tre faner: Upload, Oversigt, Claims/Reimport.

## Ændringer

Fil: `src/pages/vagt-flow/EesyFmDeviations.tsx`

- Fjern `{ value: "deleted", label: "Slettede salg" }` fra `TABS`.
- Fjern hele `<TabsContent value="deleted">`-blokken med placeholder-kortet.

Ingen andre filer eller databaseændringer.
