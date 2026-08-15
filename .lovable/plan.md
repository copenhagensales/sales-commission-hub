# Omdøb kolonnen "Type" til "Kilde"

I tabellen under "Afvigelser — oversigt" ændres den sidste kolonneoverskrift fra "Type" til "Kilde". Indholdet (hvilket ark rækken kommer fra, fx Gaden/Coop) og alle filtre, sortering og søgning er uændret.

## Teknisk

- `src/pages/vagt-flow/EesyFmDeviations.tsx`: i `OVERVIEW_COLUMNS` erstattes `"Type"` med `"Kilde"`. Ingen ændring i rækkerendering eller data.
- Grøn zone: ren labelændring.
