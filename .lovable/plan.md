# Handlinger-kolonne på "Afvigelser — oversigt"

Tilføj samme handlingskolonne længst til højre i "Afvigelser — oversigt" som den, der allerede findes under "Mangler i PowerBI".

## Hvad brugeren får

- Ny kolonne "Handlinger" yderst til højre i afvigelsestabellen.
- To knapper pr. linje, samme layout og styling som i "Mangler i PowerBI":
  - "Rediger" (grå, blyantsikon) — åbner samme redigeringsdialog (produkt, sælger, dato, telefon, notat) med muligheden "Marker som Claim/Reimport" nederst.
  - "Slet" (rød, skraldespandsikon) — samme tilstand som i dag i "Mangler i PowerBI" (visuel knap uden handling endnu).

## Teknisk

Kun `src/pages/vagt-flow/EesyFmDeviations.tsx`:

- `OVERVIEW_VIEWS`: sæt `showRowActions: true` på `deviations`-visningen.
- Kolonneoverskrift: udvid betingelsen så label bliver "Handlinger" også når `deviationMode === "deviations"` (i dag falder den tilbage til "Ret salg").
- Handlingscellen ligger allerede i den fælles `deviationMode`-gren, så knapperne genbruges 1:1 via `deviationRowToClaimSale(row)`.
- `ClaimEditDialog`: brug `claimMode="add"` for både `missing` og `deviations`, så dialogen viser "Marker som Claim/Reimport".

Ingen ændringer i hooks, data eller database.
