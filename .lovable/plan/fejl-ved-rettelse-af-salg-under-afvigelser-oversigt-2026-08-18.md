# Fejl ved rettelse af salg under "Afvigelser — oversigt"

## Årsag (verificeret)

I `useEesyFmDeviations.ts:298` får en afvigelsesrække et sammensat id:
`id: \`${sale.id}-${match.id}\`` (salgets id + PowerBI-rækkens id).

I `EesyFmDeviations.tsx:515-517` mapper `deviationRowToClaimSale` dette `row.id` direkte til `id`, som dialogen sender videre som `saleId` til opdateringen (`saleId: sale.id`, linje 341). Databasen får derfor en tekst med to uuid'er sat sammen — præcis den streng i fejlbeskeden ("invalid input syntax for type uuid: 3772e103-…-d94fff22-…").

Fanen "Mangler i PowerBI" bruger `id: sale.id` (linje 319) og rammer derfor ikke fejlen.

## Løsning

- `useEesyFmDeviations.ts`: tilføj felt `saleId: string` på `DeviationRow`, og sæt det til det rene `sale.id` både i `toRow` (afvigelser) og i "missing"-grenen. Det sammensatte `id` bevares som React-nøgle, så rækker med flere PowerBI-match fortsat er unikke.
- `EesyFmDeviations.tsx`: `deviationRowToClaimSale` bruger `row.saleId` som `id`. Det retter både Rediger og Slet, da begge går gennem samme mapper.

Ingen ændringer i pricing, løn eller DB-skema.
