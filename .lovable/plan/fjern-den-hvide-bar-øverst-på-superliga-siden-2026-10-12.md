# Fjern den hvide bar øverst på Superliga-siden

Den hvide bar er den skjulte statusbar (#placering · division · point), der vises, når man scroller ned. Selv når den er usynlig, optager den stadig plads øverst, så der kommer en lys stribe over den mørke baggrund.

## Ændring
- Kun `src/components/league/LeagueStickyBar.tsx` (grøn zone: layout).
- Barens yderboks får højden 0 og må gerne vise indhold uden for kanten (`h-0 overflow-visible`). Så optager den ikke længere plads på siden, men bliver stadig vist øverst som før, når man scroller ned.
- Den mørke baggrund går dermed helt op til toppen.
- Data og beregninger berøres ikke.
