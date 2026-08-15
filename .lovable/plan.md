# Handlinger på "Mangler i PowerBI"

Tilføj to knapper længst til venstre på hver linje under Oversigt → "Mangler i PowerBI", i samme layout som på Claims/Reimport-fanen (ghost "Rediger" med blyant, rød "Slet" med skraldespand).

## Adfærd

- **Rediger**: åbner samme dialog som under Claims/Reimport ("Ret salgsregistrering") med produkt (kun Eesy FM-produkter), sælgersøgning (min. 3 tegn), dato/tid, mobil og notat. Gemmer via samme mutation, så ændringer slår igennem i hele Stork, inkl. rematch af pricing ved produktskift.
- Nederst i dialogen vises her **"Marker som Claim/Reimport"** i stedet for "Fjern Claim/Reimport". Sættes den, får salget claim/reimport-markeringen og dukker op på Claims/Reimport-fanen.
- **Slet**: knappen tilføjes visuelt uden funktion for nu — samme som "Slet" på Claims/Reimport-fanen i dag.

## Teknisk

`src/pages/vagt-flow/EesyFmDeviations.tsx`:
- `OVERVIEW_VIEWS`: sæt `showRowActions: true` for `missing`.
- I `DeviationsPanel` deviation-tabellen: når `deviationMode === "missing"` og `showRowActions`, render en handlings-`TableCell` som **første** celle i rækken og en tilsvarende `TableHead` ("Handlinger", `w-40`) som første kolonne i headeren.
- `ClaimEditDialog` får ny prop `claimMode: "remove" | "add"` (default `"remove"`). Ved `"add"` vises checkbox "Marker som Claim/Reimport" og `keepClaim` sendes som `true` når den er markeret, ellers uændret `false`.
- Rediger-klik på en missing-række mapper `DeviationRow` til dialogens `EesyFmClaimSale`-form (`id`, `saleDatetime`, `sellerId`, `sellerName`, `phone`, `productName: storkProduct`, `note`, `approved: false`). Notatet hentes med i `useEesyFmDeviations` hvis det ikke allerede returneres.
- Ingen ændringer i lønberegning, pricing-regler eller DB-skema.
