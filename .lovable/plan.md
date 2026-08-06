# Hurtig vælg dato på Oversigt-fanen (Eesy FM afvigelser)

## Hvad der bygges

En ekstra filter-kontrol "Hurtig valg" i filterrækken på Oversigt-fanen, placeret før "Fra dato".

Valgmuligheder:
- I dag
- I går
- Denne uge
- Sidste uge
- Denne måned
- Sidste måned
- I år

Når et valg vælges, udfyldes "Fra dato" og "Til dato" automatisk med den tilsvarende periode. Ændrer brugeren manuelt en af datoerne, nulstilles hurtigvalget til "Brugerdefineret", så visningen altid matcher de faktiske datoer.

## Teknisk

- Kun `src/pages/vagt-flow/EesyFmDeviations.tsx` (grøn zone: layout/præsentation).
- `Select` fra `@/components/ui/select` til hurtigvalg; filterrækken bliver et 5-kolonne grid på store skærme.
- Perioder beregnes med `date-fns`: `startOfDay`/`endOfDay`, `subDays`, `startOfWeek`/`endOfWeek` (`weekStartsOn: 1`), `subWeeks`, `startOfMonth`/`endOfMonth`, `subMonths`, `startOfYear`/`endOfYear`.
- Ingen datahentning eller filtreringslogik — datoerne holdes fortsat i lokal state.
